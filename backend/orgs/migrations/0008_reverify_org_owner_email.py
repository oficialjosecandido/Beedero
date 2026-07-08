from django.db import migrations


def reset_unverified_org_verification(apps, schema_editor):
    """P0.3: is_verified was previously set from an email-domain match at org
    creation, without requiring the owner's email to actually be confirmed.
    Reset any org whose owner's email isn't confirmed — the next publish
    (OrgActivateView) will re-derive it correctly, gated on a verified email."""
    Organization = apps.get_model("orgs", "Organization")
    OrgMembership = apps.get_model("orgs", "OrgMembership")

    verified_owner_org_ids = OrgMembership.objects.filter(
        role="owner",
        user__email_verified_at__isnull=False,
    ).values_list("org_id", flat=True)

    Organization.objects.filter(is_verified=True).exclude(
        id__in=list(verified_owner_org_ids)
    ).update(is_verified=False)


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0007_fix_field_visibility_archived_at"),
    ]

    operations = [
        migrations.RunPython(reset_unverified_org_verification, migrations.RunPython.noop),
    ]
