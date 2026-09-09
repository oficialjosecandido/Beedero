from datetime import date

import pytest

from accounts.models import User
from affiliations.models import Affiliation, RoleType
from credibility.models import ProfessionalCredential
from orgs.models import Organization, OrgMembership

from .timeline import verified_facts_count


@pytest.fixture
def user(db):
    return User.objects.create_user(username="person", email="person@example.com", password="x")


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.mark.django_db
class TestVerifiedFactsCount:
    def test_zero_for_person_with_no_facts(self, user):
        assert verified_facts_count(user) == 0

    def test_counts_membership_verified_affiliation_and_credential(self, user, org):
        OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.MEMBER)
        Affiliation.objects.create(
            user=user,
            org=org,
            role=RoleType.ADVISOR,
            started_on=date(2023, 1, 1),
            status=Affiliation.Status.VERIFIED,
            created_by=user,
        )
        ProfessionalCredential.objects.create(
            user=user, title="Psychotherapist", issuer="Ordem", identifier="123",
            status=ProfessionalCredential.Status.VERIFIED,
        )

        assert verified_facts_count(user) == 3

    def test_excludes_pending_disputed_and_rejected(self, user, org):
        Affiliation.objects.create(
            user=user,
            org=org,
            role=RoleType.EMPLOYEE,
            started_on=date(2023, 1, 1),
            status=Affiliation.Status.PENDING,
            created_by=user,
        )
        Affiliation.objects.create(
            user=user,
            org=org,
            role=RoleType.CONTRACTOR,
            started_on=date(2023, 1, 1),
            status=Affiliation.Status.DISPUTED,
            created_by=user,
        )
        ProfessionalCredential.objects.create(
            user=user, title="Coach", issuer="Ordem", identifier="456",
            status=ProfessionalCredential.Status.REJECTED,
        )

        assert verified_facts_count(user) == 0

    def test_excludes_membership_at_non_live_org(self, user):
        draft_org = Organization.objects.create(slug="draft", name="Draft", status=Organization.Status.DRAFT)
        OrgMembership.objects.create(org=draft_org, user=user, role=OrgMembership.Role.MEMBER)

        assert verified_facts_count(user) == 0
