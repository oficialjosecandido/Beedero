"""
Beedero — painel de KPIs interno (Django admin).

Vive em /admin/kpis/, protegido pelo login de admin já existente (is_staff).
Não cria app nova, não expõe endpoints públicos, não precisa de frontend.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Max
from django.shortcuts import render
from django.utils.timezone import now
from django.views.decorators.cache import cache_page

from accounts.acquisition import acquisition_funnel
from accounts.models import User
from connections.models import Connection, ConnectionRequest
from orgs.models import Activity, FundraiseRound, Organization, OrgFollow

from .admin_access import kpi_admin_required

# --- Imports tolerantes: o painel degrada em vez de rebentar ----------------
try:
    from analytics.models import DailyOrgStats, InterestSignal, ProfileView
except ImportError:
    DailyOrgStats = ProfileView = InterestSignal = None

try:
    from credibility.levels import credibility_level
    from credibility.models import Verification
except ImportError:
    credibility_level = Verification = None

try:  # ainda não construído (está no roadmap) — o painel ignora
    from deals.models import DealReport
except ImportError:
    DealReport = None

try:
    from cofounder.models import BuilderProfile, CofounderMatch
except ImportError:
    BuilderProfile = CofounderMatch = None


WINDOW_DAYS = 7
LISBON = ZoneInfo("Europe/Lisbon")


def _count_since(model, date_field, since, **filters):
    """Novos registos na janela. Devolve None se o modelo não existir."""
    if model is None:
        return None
    return model.objects.filter(**{f"{date_field}__gte": since}, **filters).count()


def _card(label, value, section, delta=None, *, highlight=False):
    return {
        "label": label,
        "value": value,
        "section": section,
        "delta": delta,
        "has_delta": delta is not None,
        "highlight": highlight,
    }


KPI_SECTIONS = [
    ("Today", "Daily pulse — activity since midnight (Lisbon time)."),
    ("Network", "Network size, growth, and pending actions."),
    ("Trust", "Verification queue and expiry risk."),
    ("Liquidity", "Profile views, interest signals, and deals."),
    ("Activity", "Content and engagement."),
    ("Operational health", "Background jobs and data freshness."),
]


def _group_cards(cards):
    grouped = {name: [] for name, _ in KPI_SECTIONS}
    for card in cards:
        grouped.setdefault(card["section"], []).append(card)
    return [
        {"name": name, "description": description, "cards": grouped[name]}
        for name, description in KPI_SECTIONS
        if grouped.get(name)
    ]


@kpi_admin_required
@cache_page(60 * 10)
def kpis_view(request):
    since = now() - timedelta(days=WINDOW_DAYS)
    live = Organization.Status.LIVE
    draft = Organization.Status.DRAFT

    # ---------- HOJE (pulso diário, fronteira do dia em hora de Lisboa) -----
    today_local = now().astimezone(LISBON).date()
    day_start = datetime.combine(today_local, time.min, tzinfo=LISBON)

    # Pessoas = contas reais. Staff e contas marcadas `is_internal` (testes,
    # equipa) ficam fora de todos os números sobre utilizadores.
    people = User.objects.filter(is_staff=False, is_internal=False)

    new_users_today = people.filter(date_joined__gte=day_start).count()
    new_orgs_today = _count_since(Organization, "created_at", day_start, status=live)
    posts_today = _count_since(Activity, "created_at", day_start)
    # last_seen_at, não last_login: a autenticação por token (Firebase) nunca
    # chama login(), por isso last_login só mexe com logins no /admin.
    active_today = people.filter(last_seen_at__gte=day_start).count()
    new_connections_today = _count_since(Connection, "created_at", day_start)

    # ---------- REDE ----------
    orgs_live = Organization.objects.filter(status=live).count()
    orgs_draft = Organization.objects.filter(status=draft).count()
    orgs_new = _count_since(Organization, "created_at", since, status=live)

    users_total = people.count()
    users_new = people.filter(date_joined__gte=since).count()
    users_new_30d = people.filter(date_joined__gte=now() - timedelta(days=30)).count()
    users_active_7d = people.filter(last_seen_at__gte=since).count()
    # O número que importa: quem já cá estava antes desta semana e voltou.
    users_returning_7d = people.filter(last_seen_at__gte=since, date_joined__lt=since).count()
    # is_email_verified é uma @property (deriva de email_verified_at), não um
    # campo de BD — filtra pelo campo real.
    users_email_ok = people.filter(email_verified_at__isnull=False).count()
    investors_ready = people.filter(investorprofile__is_verified=True).count()
    # "Follows" aqui é só follow de organizações (OrgFollow) — pessoas
    # ligam-se por Connection, não incluído por agora.
    follows_new = _count_since(OrgFollow, "created_at", since)

    connections_total = Connection.objects.count()
    pending_requests = ConnectionRequest.objects.filter(
        status=ConnectionRequest.Status.PENDING
    ).count()
    open_rounds = FundraiseRound.objects.filter(is_open=True).count()

    # ---------- CONFIANÇA ----------
    # credibility_level() é derivado em Python -> um loop sobre as orgs live.
    # A centenas de orgs é irrelevante. Se crescer muito, cachear o resultado
    # (ex.: 15 min) ou materializar o nível numa coluna atualizada por signal.
    level_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    if credibility_level is not None:
        for org in Organization.objects.filter(status=live):
            level_counts[credibility_level(org)] += 1

    verif_pending = verif_expiring = None
    if Verification is not None:
        verif_pending = Verification.objects.filter(
            status=Verification.Status.PENDING
        ).count()
        verif_expiring = Verification.objects.filter(
            status=Verification.Status.VERIFIED,
            valid_until__lt=now() + timedelta(days=30),
        ).count()

    # ---------- LIQUIDEZ ----------
    views_week = _count_since(ProfileView, "viewed_at", since)
    signals_week = _count_since(InterestSignal, "created_at", since)

    deals_reported = deals_confirmed = None
    if DealReport is not None:
        deals_reported = DealReport.objects.filter(status="reported").count()
        deals_confirmed = DealReport.objects.filter(status="confirmed").count()

    # ---------- CO-FUNDADOR ----------
    # builders_active mede a densidade do doc §10 (não promover abaixo de 150
    # num mercado); orgs_from_match é a métrica-mãe do módulo.
    builders_active = orgs_from_match = matches_week = None
    if BuilderProfile is not None:
        builders_active = BuilderProfile.objects.filter(is_active=True).count()
        matches_week = _count_since(CofounderMatch, "created_at", since)
        orgs_from_match = CofounderMatch.objects.filter(org__isnull=False).count()

    # ---------- ATIVIDADE ----------
    posts_week = _count_since(Activity, "created_at", since)

    # ---------- GEOGRAFIA (declarada, nunca por IP) ----------
    geo_breakdown = list(
        Organization.objects.filter(status=live)
        .exclude(geo="")
        .values("geo")
        .annotate(n=Count("id"))
        .order_by("-n")
    )

    # ---------- SAÚDE OPERACIONAL ----------
    # Não existe log de execuções de jobs nem updated_at em DailyOrgStats —
    # usa a data mais recente com stats como proxy de frescura do cron
    # compute_daily_org_stats.
    daily_stats_latest = None
    daily_stats_fresh = False
    if DailyOrgStats is not None:
        daily_stats_latest = DailyOrgStats.objects.aggregate(latest=Max("date"))["latest"]
        if daily_stats_latest is not None:
            daily_stats_fresh = daily_stats_latest >= today_local - timedelta(days=1)

    cards = [
        # -- Today --
        _card("New users", new_users_today, "Today", highlight=True),
        _card("New orgs", new_orgs_today, "Today", highlight=True),
        _card("Posts", posts_today, "Today", highlight=True),
        _card("Active people", active_today, "Today", highlight=True),
        _card("New connections", new_connections_today, "Today", highlight=True),
        # -- Network --
        _card("Live orgs", orgs_live, "Network", orgs_new),
        _card("Draft orgs", orgs_draft, "Network"),
        _card("Users", users_total, "Network", users_new),
        _card("New users (30d)", users_new_30d, "Network"),
        _card("Active (7d)", users_active_7d, "Network"),
        _card("Returning (7d)", users_returning_7d, "Network", highlight=True),
        _card("Email verified", users_email_ok, "Network"),
        _card("Ready investors", investors_ready, "Network"),
        _card("New follows", follows_new, "Network") if follows_new is not None else None,
        _card("Connections", connections_total, "Network"),
        _card("Pending requests", pending_requests, "Network"),
        _card("Open rounds", open_rounds, "Network"),
        # -- Trust --
        _card("Pending verifications", verif_pending, "Trust"),
        _card("Expiring verifications (30d)", verif_expiring, "Trust"),
        # -- Liquidity --
        _card("Profile views (7d)", views_week, "Liquidity"),
        _card("Interest signals (7d)", signals_week, "Liquidity"),
        _card("Deals reported", deals_reported, "Liquidity"),
        _card("Deals confirmed", deals_confirmed, "Liquidity"),
        _card("Active builders", builders_active, "Liquidity"),
        _card("Co-founder matches (7d)", matches_week, "Liquidity"),
        _card("Orgs from a match", orgs_from_match, "Liquidity", highlight=True),
        # -- Activity --
        _card("Posts (7d)", posts_week, "Activity"),
        # -- Operational health --
        _card(
            "Daily stats — last run",
            f"{daily_stats_latest.strftime('%Y-%m-%d')}" + ("" if daily_stats_fresh else " ⚠️ stale"),
            "Operational health",
        )
        if daily_stats_latest is not None
        else None,
    ]
    cards = [c for c in cards if c is not None and c["value"] is not None]
    card_sections = _group_cards(cards)

    # ---------- Escada de credibilidade (com barra proporcional) ----------
    max_level = max(level_counts.values()) or 1
    levels = [
        {"level": lv, "count": n, "width": int(n / max_level * 240)}
        for lv, n in sorted(level_counts.items())
    ]

    # ---------- Funil de onboarding ----------
    raw_funnel = [
        ("Accounts created", users_total),
        ("Email verified", users_email_ok),
        ("Org created", orgs_draft + orgs_live),
        ("Org published (live)", orgs_live),
        ("Credibility ≥ 1", sum(n for lv, n in level_counts.items() if lv >= 1)),
        ("Credibility ≥ 3", sum(n for lv, n in level_counts.items() if lv >= 3)),
    ]
    funnel = []
    for i, (label, count) in enumerate(raw_funnel):
        prev = raw_funnel[i - 1][1] if i else 0
        pct = round(count / prev * 100) if i and prev else None
        funnel.append({"label": label, "count": count, "pct": pct})

    # ---------- Aquisição por origem (doc aquisição §8.3) ----------
    # Aqui, e não como cartões: a pergunta não é "quantos registos" mas "que
    # canais trazem pessoas que ficam", e isso só se lê numa tabela por origem.
    acquisition = acquisition_funnel()

    # ---------- Top orgs por views ----------
    top_orgs = []
    if ProfileView is not None:
        top_orgs = list(
            Organization.objects.filter(profile_views__viewed_at__gte=since)
            .annotate(views=Count("profile_views"))
            .order_by("-views")
            .values("name", "slug", "views")[:10]
        )

    return render(
        request,
        "admin/kpis.html",
        {
            "title": "KPIs Beedero",
            "window_days": WINDOW_DAYS,
            "cards": cards,
            "card_sections": card_sections,
            "levels": levels,
            "funnel": funnel,
            "acquisition": acquisition,
            "top_orgs": top_orgs,
            "geo_breakdown": geo_breakdown,
            "generated_at": now(),
        },
    )
