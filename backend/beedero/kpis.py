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


WINDOW_DAYS = 7
LISBON = ZoneInfo("Europe/Lisbon")


def _count_since(model, date_field, since, **filters):
    """Novos registos na janela. Devolve None se o modelo não existir."""
    if model is None:
        return None
    return model.objects.filter(**{f"{date_field}__gte": since}, **filters).count()


def _card(label, value, section, delta=None):
    return {
        "label": label,
        "value": value,
        "section": section,
        "delta": delta,
        "has_delta": delta is not None,
    }


@kpi_admin_required
@cache_page(60 * 10)
def kpis_view(request):
    since = now() - timedelta(days=WINDOW_DAYS)
    live = Organization.Status.LIVE
    draft = Organization.Status.DRAFT

    # ---------- HOJE (pulso diário, fronteira do dia em hora de Lisboa) -----
    today_local = now().astimezone(LISBON).date()
    day_start = datetime.combine(today_local, time.min, tzinfo=LISBON)

    new_users_today = _count_since(User, "date_joined", day_start)
    new_orgs_today = _count_since(Organization, "created_at", day_start, status=live)
    posts_today = _count_since(Activity, "created_at", day_start)
    logins_today = _count_since(User, "last_login", day_start)
    new_connections_today = _count_since(Connection, "created_at", day_start)

    # ---------- REDE ----------
    orgs_live = Organization.objects.filter(status=live).count()
    orgs_draft = Organization.objects.filter(status=draft).count()
    orgs_new = _count_since(Organization, "created_at", since, status=live)

    users_total = User.objects.count()
    users_new = _count_since(User, "date_joined", since)
    users_new_30d = _count_since(User, "date_joined", now() - timedelta(days=30))
    users_active_7d = _count_since(User, "last_login", since)
    # is_email_verified é uma @property (deriva de email_verified_at), não um
    # campo de BD — filtra pelo campo real.
    users_email_ok = User.objects.filter(email_verified_at__isnull=False).count()
    investors_ready = User.objects.filter(investorprofile__is_verified=True).count()
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
        # -- Hoje --
        _card("Novos utilizadores hoje", new_users_today, "Hoje"),
        _card("Novas orgs hoje", new_orgs_today, "Hoje"),
        _card("Posts hoje", posts_today, "Hoje"),
        _card("Logins hoje", logins_today, "Hoje"),
        _card("Novas conexões hoje", new_connections_today, "Hoje"),
        # -- Rede --
        _card("Orgs live", orgs_live, "Rede", orgs_new),
        _card("Orgs em draft", orgs_draft, "Rede"),
        _card("Utilizadores", users_total, "Rede", users_new),
        _card("Novos utilizadores (30d)", users_new_30d, "Rede"),
        _card("Ativos (7d)", users_active_7d, "Rede"),
        _card("Email verificado", users_email_ok, "Rede"),
        _card("Investidores prontos", investors_ready, "Rede"),
        _card("Novos follows", follows_new, "Rede") if follows_new is not None else None,
        _card("Conexões", connections_total, "Rede"),
        _card("Pedidos pendentes", pending_requests, "Rede"),
        _card("Rondas abertas", open_rounds, "Rede"),
        # -- Confiança --
        _card("Verificações pendentes", verif_pending, "Confiança"),
        _card("Verificações a expirar (30d)", verif_expiring, "Confiança"),
        # -- Liquidez --
        _card("Views de perfil (7d)", views_week, "Liquidez"),
        _card("Sinais de interesse (7d)", signals_week, "Liquidez"),
        _card("Deals reportados", deals_reported, "Liquidez"),
        _card("Deals confirmados", deals_confirmed, "Liquidez"),
        # -- Atividade --
        _card("Posts (7d)", posts_week, "Atividade"),
        # -- Saúde operacional --
        _card(
            "Stats diárias — última execução",
            f"{daily_stats_latest.strftime('%d/%m')}" + ("" if daily_stats_fresh else " ⚠️ atrasado"),
            "Saúde operacional",
        )
        if daily_stats_latest is not None
        else None,
    ]
    cards = [c for c in cards if c is not None and c["value"] is not None]

    # ---------- Escada de credibilidade (com barra proporcional) ----------
    max_level = max(level_counts.values()) or 1
    levels = [
        {"level": lv, "count": n, "width": int(n / max_level * 240)}
        for lv, n in sorted(level_counts.items())
    ]

    # ---------- Funil de onboarding ----------
    raw_funnel = [
        ("Contas criadas", users_total),
        ("Email verificado", users_email_ok),
        ("Org criada", orgs_draft + orgs_live),
        ("Org publicada (live)", orgs_live),
        ("Credibilidade ≥ 1", sum(n for lv, n in level_counts.items() if lv >= 1)),
        ("Credibilidade ≥ 3", sum(n for lv, n in level_counts.items() if lv >= 3)),
    ]
    funnel = []
    for i, (label, count) in enumerate(raw_funnel):
        prev = raw_funnel[i - 1][1] if i else 0
        pct = round(count / prev * 100) if i and prev else None
        funnel.append({"label": label, "count": count, "pct": pct})

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
            "levels": levels,
            "funnel": funnel,
            "top_orgs": top_orgs,
            "geo_breakdown": geo_breakdown,
            "generated_at": now(),
        },
    )
