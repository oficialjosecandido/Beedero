"""Backfill Activity from legacy OrgField posts (key startswith 'post_') and
InvestorPost. Idempotent via get_or_create on source_org_field_id /
source_investor_post_id, so it's safe to re-run after Release 2's cutover to
catch anything created in the gap between releases (plan §2)."""

from django.conf import settings
from django.db import migrations
from django.utils.dateparse import parse_datetime


def _occurred_at_of(post, fallback):
    raw = post.value.get("occurred_at")
    return (parse_datetime(raw) if raw else None) or fallback


def backfill_activity(apps, schema_editor):
    OrgField = apps.get_model("orgs", "OrgField")
    Activity = apps.get_model("orgs", "Activity")
    InvestorPost = apps.get_model("accounts", "InvestorPost")

    posts = OrgField.objects.filter(key__startswith="post_").select_related("section", "section__org")
    for post in posts:
        Activity.objects.get_or_create(
            source_org_field_id=post.id,
            defaults={
                "org_id": post.section.org_id,
                "kind": post.section.kind,
                "title": post.value.get("title", ""),
                "body": post.value.get("body", ""),
                "image": _image_name_from_url(post.value.get("image")),
                "occurred_at": _occurred_at_of(post, post.created_at),
                "visibility": post.visibility,
                "created_at": post.created_at,
            },
        )

    investor_kind_map = {"milestone": "milestones", "event": "events", "update": "update"}
    for ipost in InvestorPost.objects.all():
        Activity.objects.get_or_create(
            source_investor_post_id=ipost.id,
            defaults={
                "author_id": ipost.author_id,
                "kind": investor_kind_map.get(ipost.kind, "update"),
                "title": ipost.title,
                "body": ipost.body,
                "image": ipost.image.name if ipost.image else "",
                "occurred_at": ipost.occurred_at,
                "visibility": "public",
                "created_at": ipost.created_at,
            },
        )


def _image_name_from_url(url):
    """OrgField posts store a fully-qualified blob URL in `value["image"]`
    (see FeedPostSerializer.create); Activity.image is an ImageField, which
    needs the storage-relative name. There's exactly one storage backend
    (Azure Blob, see settings.MEDIA_URL) in every environment, so stripping
    that fixed prefix reliably recovers the name."""
    if not url:
        return ""
    prefix = settings.MEDIA_URL
    return url[len(prefix):] if url.startswith(prefix) else ""


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("orgs", "0012_create_activity"),
        ("accounts", "0004_investorpost"),
    ]

    operations = [
        migrations.RunPython(backfill_activity, noop),
    ]
