from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0017_activity_ends_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="payload",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
