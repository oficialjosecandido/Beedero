from django.db.models.signals import post_save
from django.dispatch import receiver

from .constants import ALWAYS_ON_KINDS
from .models import Organization, OrgSection


@receiver(post_save, sender=Organization)
def create_default_sections(sender, instance, created, **kwargs):
    """Identidade + Atividade existem sempre (doc §1); criadas com a org."""
    if not created:
        return
    # bulk_create ignora save(), e é o save() que aplica a visibilidade
    # default por natureza — por isso criamos uma a uma.
    for i, kind in enumerate(ALWAYS_ON_KINDS):
        OrgSection(org=instance, kind=kind, position=i).save()
