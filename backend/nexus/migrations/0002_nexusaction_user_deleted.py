from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("nexus", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="nexusaction",
            name="action",
            field=models.CharField(
                choices=[
                    ("user.suspended", "Suspended an account"),
                    ("user.reactivated", "Reactivated an account"),
                    ("user.internal", "Changed internal flag"),
                    ("user.verified", "Changed Beedero verification (person)"),
                    ("user.deleted", "Deleted an account"),
                    ("org.comp", "Changed complimentary plan"),
                    ("org.free_extended", "Extended free period"),
                    ("org.verified", "Changed Beedero verification (organisation)"),
                    ("post.removed", "Removed a post"),
                    ("post.restored", "Restored a post"),
                    ("report.resolved", "Resolved a report"),
                    ("newsletter.test", "Sent a test email"),
                    ("newsletter.sent", "Sent an email campaign"),
                    ("contacts.added", "Added newsletter contacts"),
                    ("contact.removed", "Removed a newsletter contact"),
                    ("promo.created", "Created a promo code"),
                    ("promo.changed", "Changed a promo code"),
                    ("invoice.issued", "Recorded a fatura"),
                ],
                db_index=True,
                max_length=30,
            ),
        ),
    ]
