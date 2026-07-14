"""Milestone triggers (doc §5): followers 50/100/500/1000, credibility
level-up, round closed, first post, org anniversary. Each fires an in-app
notification via `notify_milestone` (idempotent forever, not just within
the 6h window) plus a pre-filled post suggestion the founder can copy into
the composer and publish manually — nothing here auto-publishes anything.
"""

from django.contrib.auth import get_user_model

from orgs.models import Activity, OrgFollow, OrgMembership

from .services import notify_milestone

User = get_user_model()

FOLLOWER_THRESHOLDS = [50, 100, 500, 1000]


def _org_owners(org):
    return User.objects.filter(
        orgmembership__org=org,
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN],
    ).distinct()


def check_follower_milestone(org):
    count = OrgFollow.objects.filter(org=org).count()
    if count not in FOLLOWER_THRESHOLDS:
        return
    for owner in _org_owners(org):
        notify_milestone(
            owner,
            aggregate_key=f"milestone:followers:{org.id}:{count}",
            title="Follower milestone",
            body=f"{org.name} just reached {count} followers on Beedero!",
            link=f"/dashboard/{org.slug}",
            suggestion_title=f"We just hit {count} followers on Beedero! 🎉",
            suggestion_body=(
                f"Thank you to everyone following {org.name}'s journey so far — "
                "excited for what's next."
            ),
        )


def check_credibility_level_milestone(org, previous_level: int, new_level: int):
    if new_level <= previous_level:
        return
    for owner in _org_owners(org):
        notify_milestone(
            owner,
            aggregate_key=f"milestone:credibility:{org.id}:{new_level}",
            title="Credibility level up",
            body=f"{org.name} reached credibility level {new_level}.",
            link=f"/dashboard/{org.slug}",
            suggestion_title=f"{org.name} just leveled up on Beedero!",
            suggestion_body=(
                f"We're now verified to credibility level {new_level} on Beedero — "
                "another step towards being investor-ready."
            ),
        )


def check_round_closed_milestone(org, round_):
    for owner in _org_owners(org):
        raised = round_.raised_amount
        raised_note = f" raising {raised:,}" if raised else ""
        notify_milestone(
            owner,
            aggregate_key=f"milestone:round_closed:{round_.id}",
            title="Round closed",
            body=f"{org.name} closed its {round_.get_stage_display()} round.",
            link=f"/dashboard/{org.slug}",
            suggestion_title=f"We closed our {round_.get_stage_display()} round!",
            suggestion_body=(
                f"Thrilled to share that {org.name} closed its {round_.get_stage_display()} round"
                f"{raised_note}. Thank you to everyone who backed us."
            ),
        )


def check_first_post_milestone(org):
    if Activity.objects.filter(org=org).count() != 1:
        return
    for owner in _org_owners(org):
        notify_milestone(
            owner,
            aggregate_key=f"milestone:first_post:{org.id}",
            title="First update posted",
            body=f"{org.name} shared its first update.",
            link=f"/dashboard/{org.slug}",
            suggestion_title="We're now sharing updates on Beedero!",
            suggestion_body=f"Follow {org.name} on Beedero for our latest news, milestones, and traction.",
        )


def check_org_anniversary_milestone(org, today):
    created = org.created_at.date()
    years = today.year - created.year
    if years < 1:
        return
    if (created.month, created.day) != (today.month, today.day):
        return
    for owner in _org_owners(org):
        notify_milestone(
            owner,
            aggregate_key=f"milestone:anniversary:{org.id}:{years}",
            title="Org anniversary",
            body=f"{org.name} has been on Beedero for {years} year(s).",
            link=f"/dashboard/{org.slug}",
            suggestion_title=f"{years} year(s) on Beedero!",
            suggestion_body=f"Celebrating {years} year(s) building {org.name} — thank you for following along.",
        )
