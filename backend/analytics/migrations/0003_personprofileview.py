import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("analytics", "0002_dailyorgstats"),
    ]

    operations = [
        migrations.CreateModel(
            name="PersonProfileView",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("viewed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "subject",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="person_profile_views",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "viewer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="person_profiles_viewed",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [models.Index(fields=["subject", "-viewed_at"], name="analytics_pe_subject_6e8b0d_idx")],
            },
        ),
    ]
