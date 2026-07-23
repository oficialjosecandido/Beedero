import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("analytics", "0004_activityfeedimpression"),
    ]

    operations = [
        migrations.CreateModel(
            name="PipelineEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "stage",
                    models.CharField(
                        choices=[
                            ("watching", "Watching"),
                            ("reviewing", "Reviewing"),
                            ("meeting", "Meeting"),
                            ("diligence", "Diligence"),
                            ("passed", "Passed"),
                            ("invested", "Invested"),
                        ],
                        default="watching",
                        max_length=12,
                    ),
                ),
                ("note", models.TextField(blank=True, default="", max_length=2000)),
                ("pass_reason", models.CharField(blank=True, default="", max_length=200)),
                ("next_action_at", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "investor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pipeline_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "org",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pipeline_entries",
                        to="orgs.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="pipelineentry",
            index=models.Index(fields=["investor", "stage"], name="analytics_p_investo_6a0f8d_idx"),
        ),
        migrations.AddConstraint(
            model_name="pipelineentry",
            constraint=models.UniqueConstraint(fields=("investor", "org"), name="uniq_pipeline_entry"),
        ),
    ]
