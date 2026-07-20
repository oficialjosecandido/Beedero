import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0021_recompact_org_slugs"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("messaging", "0003_fix_conversation_rls_policy"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrgConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_message_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "external_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="org_conversations_as_external",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "org",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="org_conversations",
                        to="orgs.organization",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="OrgMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.CharField(max_length=4000)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                (
                    "org_conversation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="messaging.orgconversation",
                    ),
                ),
                (
                    "sender",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sent_org_messages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="orgconversation",
            constraint=models.UniqueConstraint(
                fields=("org", "external_user"), name="uniq_org_external_user_conversation"
            ),
        ),
        migrations.AddIndex(
            model_name="orgmessage",
            index=models.Index(fields=["org_conversation", "-created_at"], name="messaging_o_org_con_0d8f8d_idx"),
        ),
    ]
