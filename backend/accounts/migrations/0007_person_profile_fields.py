from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_user_entra_oid"),
    ]

    operations = [
        migrations.AddField(
            model_name="investorprofile",
            name="handle",
            field=models.SlugField(blank=True, db_index=True, max_length=50, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="investorprofile",
            name="visibility",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="investorprofile",
            name="attestation_prefs",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
