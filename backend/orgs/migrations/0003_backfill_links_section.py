from django.db import migrations


def backfill_links_section(apps, schema_editor):
    Organization = apps.get_model("orgs", "Organization")
    OrgSection = apps.get_model("orgs", "OrgSection")
    for org in Organization.objects.all():
        OrgSection.objects.get_or_create(org=org, kind="links", defaults={"visibility": "public"})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0002_orgfollow_userfollow"),
    ]

    operations = [
        migrations.RunPython(backfill_links_section, noop),
    ]
