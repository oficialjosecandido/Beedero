import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0019_orgmembership_title"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("analytics", "0003_personprofileview"),
    ]

    operations = [
        migrations.CreateModel(
            name="ActivityFeedImpression",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feed_impressions",
                        to="orgs.activity",
                    ),
                ),
                (
                    "viewer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_feed_impressions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["activity", "-viewed_at"], name="analytics_ac_activit_5f2c1a_idx")
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="activityfeedimpression",
            constraint=models.UniqueConstraint(
                fields=("activity", "viewer"),
                name="uniq_feed_impression_per_viewer_per_activity",
            ),
        ),
    ]
