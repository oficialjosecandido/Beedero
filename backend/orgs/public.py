"""Caminho público — separado por construção (§3.4).

Não autenticado, não conhece grants nem campos restritos/privados. Só
consegue, por código, tocar em `visibility=public`. É fisicamente impossível
vazar por aqui porque o filtro `PUBLIC` está escrito no próprio query, não
depende de nenhuma decisão de runtime.
"""

from collections import defaultdict

from django.shortcuts import get_object_or_404

from .models import OrgField, Organization, Visibility


def public_profile(slug: str) -> dict:
    org = get_object_or_404(Organization, slug=slug)
    fields = OrgField.objects.filter(
        section__org=org,
        section__archived_at__isnull=True,
        visibility=Visibility.PUBLIC,  # e nada mais, sempre
    ).select_related("section")

    sections = defaultdict(dict)
    for f in fields:
        sections[f.section.kind][f.key] = f.value

    return {
        "org": {
            "slug": org.slug,
            "name": org.name,
            "is_verified": org.is_verified,
            "is_fundraising": org.is_fundraising,
        },
        "sections": sections,
    }
