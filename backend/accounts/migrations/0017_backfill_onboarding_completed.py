from django.db import migrations


def backfill_onboarding_completed(apps, schema_editor):
    """Everyone who existed before onboarding did has already been through it.

    The flag's only job is to decide whether the feed sends somebody to
    /onboarding. Leaving established accounts null would bounce all of them
    into a flow written for a first visit — and would reopen the one step that
    must not reopen: the handle. Migration 0008 gave every existing profile a
    /p/<handle> address, so those are links people may already have shared, and
    `accounts/onboarding.py` only treats a handle as frozen once this column is
    set.

    Stamped with the account's own `date_joined` rather than "now", so the
    column never claims somebody onboarded today when they didn't.
    """
    InvestorProfile = apps.get_model("accounts", "InvestorProfile")

    batch = []
    for profile in (
        InvestorProfile.objects.filter(onboarding_completed_at__isnull=True)
        .select_related("user")
        .iterator()
    ):
        profile.onboarding_completed_at = profile.user.date_joined
        batch.append(profile)
        if len(batch) >= 500:
            InvestorProfile.objects.bulk_update(batch, ["onboarding_completed_at"])
            batch = []
    if batch:
        InvestorProfile.objects.bulk_update(batch, ["onboarding_completed_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0016_investorprofile_intents_and_more"),
    ]

    operations = [
        # Irreversible by design: a reverse pass cannot tell a backfilled row
        # from one written by somebody who actually finished the flow after
        # this ran, and clearing the latter would unfreeze their handle.
        migrations.RunPython(backfill_onboarding_completed, migrations.RunPython.noop),
    ]
