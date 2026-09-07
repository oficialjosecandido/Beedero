from django.db import migrations


def reset_stale_push_prefs(apps, schema_editor):
    """push_enabled=True with no PushSubscription behind it is inert (see
    0011) — reset those so the toggle renders unchecked and users actually
    get the permission prompt when they click it."""
    NotificationPreference = apps.get_model("notifications", "NotificationPreference")
    PushSubscription = apps.get_model("notifications", "PushSubscription")
    subscribed_user_ids = set(PushSubscription.objects.values_list("user_id", flat=True))
    NotificationPreference.objects.filter(push_enabled=True).exclude(
        user_id__in=subscribed_user_ids
    ).update(push_enabled=False)


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0011_alter_notificationpreference_push_enabled"),
    ]

    operations = [
        migrations.RunPython(reset_stale_push_prefs, migrations.RunPython.noop),
    ]
