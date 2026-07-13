"""Members should follow the organizations they belong to so feed + follows stay in sync."""

from django.db import migrations


def backfill_member_follows(apps, schema_editor):
    OrgMembership = apps.get_model("orgs", "OrgMembership")
    OrgFollow = apps.get_model("orgs", "OrgFollow")
    for membership in OrgMembership.objects.all().iterator():
        OrgFollow.objects.get_or_create(user_id=membership.user_id, org_id=membership.org_id)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("orgs", "0014_activity_rls"),
    ]

    operations = [
        migrations.RunPython(backfill_member_follows, noop),
    ]
