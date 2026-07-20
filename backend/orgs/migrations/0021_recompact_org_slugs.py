from django.db import migrations


def recompact_org_slugs(apps, schema_editor):
    Organization = apps.get_model("orgs", "Organization")
    from orgs.views import unique_org_slug

    for org in Organization.objects.order_by("pk"):
        org.slug = f"tmp{org.pk}"
        org.save(update_fields=["slug"])

    for org in Organization.objects.order_by("pk"):
        org.slug = unique_org_slug(org.name)
        org.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0020_activity_feed_impression_count"),
        ("accounts", "0009_recompact_person_handles"),
    ]

    operations = [
        migrations.RunPython(recompact_org_slugs, migrations.RunPython.noop),
    ]
