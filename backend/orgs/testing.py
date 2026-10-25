"""Test helpers for organisations.

`unlock_org()` takes a test organisation past rungs 1–4 of its ladder
(orgs/ladder.py), so tests about Discover, suggestions or alerts start from an
organisation that is allowed to be listed. It only fills what is blank — a
test that set a stage, a sector or a one-liner keeps it — and it never
changes the status: pass `status=Organization.Status.LIVE` (or create the org
live) when the test needs it published.

The face behind it is one shared, already-unlocked person unless `person` is
given, so a test that creates sixty organisations does not create sixty
people. That person lives in a city no test uses, so they never turn an
organisation into a "local" one or show up among people from a real city.
"""

from accounts.models import User
from accounts.testing import unlock

from .constants import SectionKind
from .models import OrgField, OrgMembership, OrgSection

ABOUT = {"summary": "We build things.", "mission": "Build.", "vision": "Built.", "values": "Care."}


def _shared_founder():
    user, _ = User.objects.get_or_create(
        username="ladder-founder", defaults={"email": "ladder-founder@example.com"}
    )
    unlock(user, city="Ladder Town")
    return user


def unlock_org(org, person=None, **fields):
    for field, value in fields.items():
        setattr(org, field, value)
    org.logo = org.logo or "org_logos/test.png"
    org.one_liner = org.one_liner or "A company that does one thing well."
    org.stage = org.stage or "seed"
    org.sector = org.sector or "fintech"
    org.geo = org.geo or "PT"
    org.save()

    founder = person or _shared_founder()
    if person is not None:
        unlock(person)
    membership, created = OrgMembership.objects.get_or_create(
        org=org, user=founder, defaults={"role": OrgMembership.Role.OWNER}
    )
    if not created and membership.role not in (OrgMembership.Role.OWNER, OrgMembership.Role.ADMIN):
        membership.role = OrgMembership.Role.OWNER
        membership.save(update_fields=["role"])

    about, _ = OrgSection.objects.get_or_create(org=org, kind=SectionKind.ABOUT)
    for key, value in ABOUT.items():
        OrgField.objects.get_or_create(section=about, key=key, defaults={"value": value})
    products, _ = OrgSection.objects.get_or_create(org=org, kind=SectionKind.PRODUCTS)
    OrgField.objects.get_or_create(section=products, key="overview", defaults={"value": "The product."})
    return org
