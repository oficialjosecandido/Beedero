"""Who a send goes to. Every segment is built from the same base — active
accounts with a confirmed email that aren't test or team accounts — and the
newsletter segments only ever include people who opted in.

A recipient is (email, user_id, contact_id); emails are lower-cased and
de-duplicated, an account winning over a contact with the same address.
"""

from dataclasses import dataclass

from django.db.models import Q
from django.db.models.functions import Lower

from accounts.models import User
from orgs.models import OrgMembership

from .models import NewsletterRecipient, NewsletterSend


@dataclass(frozen=True)
class Segment:
    key: str
    kind: str
    label: str
    description: str


NEWSLETTER = NewsletterSend.Kind.NEWSLETTER
ANNOUNCEMENT = NewsletterSend.Kind.ANNOUNCEMENT

SEGMENTS = [
    Segment("subscribers", NEWSLETTER, "All subscribers", "Accounts that opted in, plus newsletter contacts."),
    Segment("subscribed_accounts", NEWSLETTER, "Subscribed accounts", "Accounts that opted in. No contacts."),
    Segment("subscribed_founders", NEWSLETTER, "Subscribed founders", "Opted-in owners and admins of an organisation."),
    Segment("subscribed_investors", NEWSLETTER, "Subscribed investors", "Opted-in accounts that said they invest."),
    Segment("contacts", NEWSLETTER, "Contacts only", "Newsletter contacts without an account."),
    Segment("all_accounts", ANNOUNCEMENT, "Every account", "Every active account. Service announcements only."),
    Segment("org_owners", ANNOUNCEMENT, "Organisation owners", "Owners and admins of an organisation."),
]
SEGMENTS_BY_KEY = {segment.key: segment for segment in SEGMENTS}


def reachable_users():
    return User.objects.filter(is_active=True, is_internal=False, email_verified_at__isnull=False).exclude(email="")


def _opted_in(users):
    return users.filter(notification_preference__newsletter_opt_in=True)


def _org_admins(users):
    return users.filter(
        orgmembership__role__in=[OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN]
    ).distinct()


def _investors(users):
    return users.filter(investorprofile__intents__contains=["invest"])


def _users_for(key: str):
    base = reachable_users()
    return {
        "subscribers": _opted_in(base),
        "subscribed_accounts": _opted_in(base),
        "subscribed_founders": _org_admins(_opted_in(base)),
        "subscribed_investors": _investors(_opted_in(base)),
        "contacts": base.none(),
        "all_accounts": base,
        "org_owners": _org_admins(base),
    }[key]


def _contacts_for(key: str):
    if key in ("subscribers", "contacts"):
        return NewsletterRecipient.objects.filter(unsubscribed_at__isnull=True)
    return NewsletterRecipient.objects.none()


def recipients(key: str) -> list[tuple[str, int | None, int | None]]:
    if key not in SEGMENTS_BY_KEY:
        raise KeyError(key)
    found: dict[str, tuple[str, int | None, int | None]] = {}
    for user_id, email in _users_for(key).values_list("id", "email"):
        address = email.strip().lower()
        found.setdefault(address, (address, user_id, None))
    for contact_id, email in _contacts_for(key).values_list("id", "email"):
        address = email.strip().lower()
        found.setdefault(address, (address, None, contact_id))
    # An address that belongs to an account follows that account's choice:
    # a contact row never brings back someone who unsubscribed as a user.
    contact_addresses = [address for address, user_id, _ in found.values() if user_id is None]
    account_emails = set(
        User.objects.annotate(address=Lower("email"))
        .filter(address__in=contact_addresses)
        .exclude(Q(notification_preference__newsletter_opt_in=True))
        .values_list("address", flat=True)
    )
    if SEGMENTS_BY_KEY[key].kind == NEWSLETTER:
        for address in account_emails:
            found.pop(address, None)
    return sorted(found.values())


def segment_counts() -> list[dict]:
    return [
        {
            "key": segment.key,
            "kind": segment.kind,
            "label": segment.label,
            "description": segment.description,
            "count": len(recipients(segment.key)),
        }
        for segment in SEGMENTS
    ]
