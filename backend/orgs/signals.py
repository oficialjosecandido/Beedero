from django.db.models.signals import post_save
from django.dispatch import receiver

from .constants import ALWAYS_ON_KINDS
from .models import Organization, OrgSection


@receiver(post_save, sender=Organization)
def create_default_sections(sender, instance, created, **kwargs):
    """Identity + Activity always exist (doc §1); created with the org."""
    if not created:
        return
    # bulk_create bypasses save(), and it's save() that applies the
    # per-nature default visibility — so we create them one at a time.
    for i, kind in enumerate(ALWAYS_ON_KINDS):
        OrgSection(org=instance, kind=kind, position=i).save()
