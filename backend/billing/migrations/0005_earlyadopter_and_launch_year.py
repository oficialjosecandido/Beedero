"""Launch day for organisation subscriptions.

- The EARLYADOPTER code: a free year, no card.
- Every organisation that already exists gets the same free year, counted
  from the moment this migration runs (`source = launch`).
- Beedero's own organisation is complimentary, with no end.
"""

from datetime import timedelta

from django.db import migrations
from django.utils import timezone

FREE_DAYS = 365


def forwards(apps, schema_editor):
    PromoCode = apps.get_model("billing", "PromoCode")
    Subscription = apps.get_model("billing", "Subscription")
    Organization = apps.get_model("orgs", "Organization")

    PromoCode.objects.get_or_create(
        code="EARLYADOPTER",
        defaults={"free_days": FREE_DAYS, "active": True, "note": "Launch code: first year free, no card."},
    )

    now = timezone.now()
    has_plan = set(
        Subscription.objects.filter(plan__in=["org_yearly", "org_monthly", "comp"]).values_list("org_id", flat=True)
    )
    rows = []
    for org in Organization.objects.exclude(pk__in=has_plan).only("pk", "slug").iterator():
        if org.slug == "beedero":
            rows.append(Subscription(org_id=org.pk, plan="comp", status="active", source="admin"))
        else:
            rows.append(
                Subscription(
                    org_id=org.pk,
                    plan="org_yearly",
                    status="trialing",
                    source="launch",
                    trial_end=now + timedelta(days=FREE_DAYS),
                )
            )
    Subscription.objects.bulk_create(rows, batch_size=500)


def backwards(apps, schema_editor):
    Subscription = apps.get_model("billing", "Subscription")
    PromoCode = apps.get_model("billing", "PromoCode")
    Subscription.objects.filter(source="launch").delete()
    Subscription.objects.filter(source="admin", plan="comp", org__slug="beedero").delete()
    PromoCode.objects.filter(code="EARLYADOPTER", subscriptions__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0004_organisation_subscriptions"),
        ("orgs", "0030_membership_details_confirmed_by"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
