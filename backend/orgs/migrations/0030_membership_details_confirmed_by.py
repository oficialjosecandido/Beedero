import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Record who attested a roster row's details.

    Rows that predate this field keep a null confirmer: we genuinely do not
    know who confirmed them, and guessing would write a fabricated attestation
    into an audit field. They read as self-declared until an admin confirms
    them again (orgs/membership_details.py).
    """

    dependencies = [
        ("orgs", "0029_organization_discoverable_since"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="orgmembership",
            name="details_confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="orgmembership",
            name="details_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
