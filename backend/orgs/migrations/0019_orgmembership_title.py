from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0018_activity_payload"),
    ]

    operations = [
        migrations.AddField(
            model_name="orgmembership",
            name="title",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
