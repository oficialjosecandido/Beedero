from django.db import migrations


def recompact_person_handles(apps, schema_editor):
    InvestorProfile = apps.get_model("accounts", "InvestorProfile")
    from accounts.handles import ensure_profile_handle

    InvestorProfile.objects.update(handle=None)
    for profile in InvestorProfile.objects.select_related("user").order_by("pk"):
        ensure_profile_handle(profile, allow_email_fallback=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_backfill_person_handles"),
    ]

    operations = [
        migrations.RunPython(recompact_person_handles, migrations.RunPython.noop),
    ]
