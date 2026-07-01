"""Motor de descoberta (§6) — versão MVP.

Regra dura: a descoberta só pode filtrar/ordenar por campos que o viewer
teria direito a ver *naquele* perfil. Nunca se filtra sobre a tabela crua de
campos privados/restritos sem checar visibilidade por org.

Os filtros de identidade (stage/sector/geo) vivem em colunas simples e
sempre-públicas da Organization (ver orgs/models.py) — não passam pelo
OrgField genérico porque são precisamente o que a descoberta pública usa
para indexar. Filtros por métricas restritas (ex. mrr) só se aplicam para
investidores verificados, e mesmo assim só olhando para orgs onde esse
campo específico está visível ao viewer (grant concreto), nunca à cega.

A tabela desnormalizada por role fica para v2 (§8) — aqui resolve-se
org-a-org, aceitável ao volume do MVP.
"""

from .models import Organization
from .visibility import VisibilityResolver

RESTRICTED_METRIC_KEYS = {"mrr", "arr", "valuation"}


def _is_verified_investor(viewer) -> bool:
    if not viewer or not viewer.is_authenticated:
        return False
    profile = getattr(viewer, "investorprofile", None)
    return bool(profile and profile.is_verified)


def discover(viewer, params: dict):
    qs = Organization.objects.all()

    if params.get("stage"):
        qs = qs.filter(stage=params["stage"])
    if params.get("sector"):
        qs = qs.filter(sector=params["sector"])
    if params.get("geo"):
        qs = qs.filter(geo=params["geo"])
    if params.get("fundraising") == "true":
        qs = qs.filter(is_fundraising=True)

    metric_key = params.get("metric")
    metric_min = params.get("metric_min")
    if metric_key in RESTRICTED_METRIC_KEYS and metric_min is not None:
        if not _is_verified_investor(viewer):
            # utilizador não verificado: filtro restrito é ignorado, nunca
            # aplicado às cegas.
            return qs.order_by("name")
        try:
            threshold = float(metric_min)
        except ValueError:
            return qs.order_by("name")

        matching_ids = []
        for org in qs:
            resolver = VisibilityResolver(viewer=viewer, org=org)
            field = resolver.visible_fields().filter(key=metric_key).first()
            if field is None:
                continue
            try:
                if float(field.value) >= threshold:
                    matching_ids.append(org.id)
            except (TypeError, ValueError):
                continue
        qs = qs.filter(id__in=matching_ids)

    return qs.order_by("name")
