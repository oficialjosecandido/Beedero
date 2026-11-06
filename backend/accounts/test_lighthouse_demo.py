import pytest
from django.core.management import call_command

from accounts.models import InvestorProfile, User
from orgs.models import Organization, OrgMembership


@pytest.mark.django_db
def test_ensure_lighthouse_demo_creates_public_person_and_org():
    call_command("ensure_lighthouse_demo_person")
    call_command("ensure_lighthouse_demo_person")  # idempotent

    user = User.objects.get(email="lighthouse-demo@beedero.invalid")
    assert user.is_internal
    profile = InvestorProfile.objects.get(user=user)
    assert profile.handle == "lighthouse-demo"

    org = Organization.objects.get(slug="lighthouse-demo")
    assert org.status == Organization.Status.LIVE
    assert OrgMembership.objects.filter(org=org, user=user, role=OrgMembership.Role.OWNER).exists()
