from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0025_alter_activity_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="orgmembership",
            name="details_status",
            field=models.CharField(
                choices=[("confirmed", "Confirmed"), ("pending", "Pending")],
                db_index=True,
                default="confirmed",
                max_length=12,
            ),
        ),
    ]
