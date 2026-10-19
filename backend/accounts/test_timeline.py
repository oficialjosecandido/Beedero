from datetime import date

import pytest

from accounts.models import InvestorProfile, User
from affiliations.models import Affiliation, RoleType
from credibility.models import ProfessionalCredential
from orgs.models import MembershipSkill, Organization, OrgMembership

from .timeline import aggregate_anchored_skills, merged_days, person_timeline, verified_facts_count


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


@pytest.mark.django_db
class TestPersonTimeline:
    def test_draft_membership_shows_as_verified_without_public_slug(self, user):
        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        draft_org = Organization.objects.create(
            slug="bidroom", name="BidRoom", status=Organization.Status.DRAFT
        )
        OrgMembership.objects.create(
            org=draft_org,
            user=user,
            role=OrgMembership.Role.OWNER,
            title="Founder",
            started_on=date(2024, 1, 1),
        )

        bands = person_timeline(profile, viewer=user)

        assert len(bands) == 1
        assert bands[0]["org_name"] == "BidRoom"
        assert bands[0]["title"] == "Founder"
        assert bands[0]["verified"] is True
        assert bands[0]["verified_via"] == "org_membership"
        assert bands[0]["org_slug"] is None

    def test_self_declared_duplicate_of_membership_is_hidden(self, user):
        from accounts.models import SelfDeclaredExperience

        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        org = Organization.objects.create(slug="bidroom", name="BidRoom", status=Organization.Status.LIVE)
        OrgMembership.objects.create(
            org=org, user=user, role=OrgMembership.Role.OWNER, started_on=date(2024, 1, 1)
        )
        SelfDeclaredExperience.objects.create(
            user=user, org_name="BidRoom", role="Founder", started_on=date(2024, 1, 1)
        )

        bands = person_timeline(profile, viewer=user)

        assert len(bands) == 1
        assert bands[0]["verified"] is True
        assert bands[0]["verified_via"] == "org_membership"


class TestMergedDays:
    """Time in practice is calendar time: two roles at once are one stretch."""

    def test_no_periods_is_zero(self):
        assert merged_days([]) == 0

    def test_single_period_is_its_own_length(self):
        assert merged_days([(date(2024, 1, 1), date(2024, 1, 31))]) == 30

    def test_overlapping_periods_count_once(self):
        # Jan–Dec and Jun–Dec is a year of practice, not eighteen months.
        assert merged_days(
            [(date(2024, 1, 1), date(2025, 1, 1)), (date(2024, 6, 1), date(2025, 1, 1))]
        ) == 366

    def test_a_period_inside_another_adds_nothing(self):
        assert merged_days(
            [(date(2024, 1, 1), date(2026, 1, 1)), (date(2024, 6, 1), date(2024, 9, 1))]
        ) == 731

    def test_touching_periods_merge_without_double_counting_the_seam(self):
        assert merged_days(
            [(date(2024, 1, 1), date(2024, 7, 1)), (date(2024, 7, 1), date(2025, 1, 1))]
        ) == 366

    def test_separate_periods_add_up(self):
        assert merged_days(
            [(date(2020, 1, 1), date(2020, 3, 1)), (date(2024, 1, 1), date(2024, 2, 1))]
        ) == 60 + 31


@pytest.mark.django_db
class TestAggregateAnchoredSkills:
    def _profile(self, user):
        profile, _ = InvestorProfile.objects.get_or_create(user=user)
        return profile

    def _membership(self, user, slug, *, started_on, ended_on=None, skills=(), confirmed=False):
        org = Organization.objects.create(
            slug=slug, name=slug.title(), status=Organization.Status.LIVE
        )
        membership = OrgMembership.objects.create(
            org=org,
            user=user,
            role=OrgMembership.Role.MEMBER,
            started_on=started_on,
            ended_on=ended_on,
        )
        for skill in skills:
            MembershipSkill.objects.create(
                membership=membership,
                skill=skill,
                status=(
                    MembershipSkill.Status.ORG_CONFIRMED
                    if confirmed
                    else MembershipSkill.Status.DECLARED
                ),
            )
        return membership

    def test_concurrent_roles_do_not_inflate_a_shared_skill(self, user):
        """The bug this guards: two overlapping founder roles sharing a skill
        used to report the sum of both rows — four years of React for somebody
        who had been writing it for two."""
        self._membership(
            user, "bidroom", started_on=date(2024, 1, 1), skills=["React", "Python"]
        )
        self._membership(user, "beedero", started_on=date(2025, 5, 1), skills=["React"])

        by_skill = {entry["skill"]: entry for entry in aggregate_anchored_skills(self._profile(user))}

        calendar_years = round((date.today() - date(2024, 1, 1)).days / 365, 1)
        assert by_skill["React"]["years"] == calendar_years
        # Still two orgs — the overlap changes the time, not the count.
        assert by_skill["React"]["org_count"] == 2
        # A skill from one record only is unaffected.
        assert by_skill["Python"]["years"] == calendar_years

    def test_consecutive_roles_add_up(self, user):
        self._membership(
            user,
            "first",
            started_on=date(2020, 1, 1),
            ended_on=date(2021, 1, 1),
            skills=["Design"],
        )
        self._membership(
            user,
            "second",
            started_on=date(2023, 1, 1),
            ended_on=date(2024, 1, 1),
            skills=["Design"],
        )

        [entry] = aggregate_anchored_skills(self._profile(user))

        assert entry["years"] == round((366 + 365) / 365, 1)

    def test_org_confirmation_survives_the_merge(self, user):
        self._membership(
            user, "one", started_on=date(2024, 1, 1), skills=["Go"], confirmed=True
        )
        self._membership(user, "two", started_on=date(2024, 6, 1), skills=["Go"])

        [entry] = aggregate_anchored_skills(self._profile(user))

        assert entry["confirmed"] is True
