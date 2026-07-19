from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0017_activity_ends_at"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("social", "0003_fix_social_rls_insert"),
    ]

    operations = [
        migrations.CreateModel(
            name="EventParticipation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[("going", "Going")],
                        default="going",
                        max_length=10,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="participations",
                        to="orgs.activity",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="event_participations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="eventparticipation",
            constraint=models.UniqueConstraint(
                fields=("activity", "user"),
                name="uniq_event_participation_per_user",
            ),
        ),
    ]
