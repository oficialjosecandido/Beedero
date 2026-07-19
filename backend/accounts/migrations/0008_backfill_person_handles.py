from django.db import migrations
from django.db.models import Q


def backfill_person_handles(apps, schema_editor):
    InvestorProfile = apps.get_model("accounts", "InvestorProfile")
    from accounts.handles import ensure_profile_handle

    qs = InvestorProfile.objects.filter(Q(handle__isnull=True) | Q(handle=""))
    for profile in qs.select_related("user").iterator():
        ensure_profile_handle(profile, allow_email_fallback=True)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_person_profile_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_person_handles, migrations.RunPython.noop),
    ]
