from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0019_orgmembership_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="feed_impression_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
