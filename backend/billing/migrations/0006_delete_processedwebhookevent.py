"""Drops `ProcessedWebhookEvent`.

`StripeEvent` (0004) is the webhook's idempotency key now, and every write
from Stripe goes through `subscriptions.handle_event`. This table was the old
key and nothing in the tree reads it.

The code running in production until this deploy does write to it on every
webhook, so during a rolling deploy an old instance that received an event
would hit a table that is gone: it answers 500, Stripe retries, and the new
instance handles the retry idempotently. To avoid even that window, deploy
with `migrate billing 0005` and let this one land in the next deploy.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0005_earlyadopter_and_launch_year"),
    ]

    operations = [migrations.DeleteModel(name="ProcessedWebhookEvent")]
