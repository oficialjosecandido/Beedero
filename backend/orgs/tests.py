from datetime import timedelta

import pytest
from django.utils.timezone import now

from accounts.models import InvestorProfile, User
from orgs.constants import SectionKind
from orgs.models import (
    OrgField,
    OrgMembership,
    Organization,
    OrgSection,
    Visibility,
    VisibilityGrant,
)
from orgs.visibility import VisibilityResolver


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme")


@pytest.fixture
def about_public_field(org):
    section = org.sections.get(kind=SectionKind.ABOUT)
    return OrgField.objects.create(section=section, key="tagline", value="We build things")


@pytest.fixture
def founder(db, org):
    user = User.objects.create_user(username="founder", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def outsider(db):
    return User.objects.create_user(username="outsider", password="x")


@pytest.fixture
def verified_investor(db):
    user = User.objects.create_user(username="investor", password="x")
    InvestorProfile.objects.create(user=user, is_verified=True)
    return user


def _open_fundraise_section(org, kind=SectionKind.FINANCIALS):
    org.is_fundraising = True
    org.save()
    return OrgSection.objects.create(org=org, kind=kind)


@pytest.mark.django_db
def test_anonymous_sees_only_public(org, about_public_field):
    section = about_public_field.section
    OrgField.objects.create(section=section, key="secret", value="x", visibility=Visibility.PRIVATE)

    resolver = VisibilityResolver(viewer=None, org=org)
    keys = {f.key for f in resolver.visible_fields()}

    assert keys == {"tagline"}


@pytest.mark.django_db
def test_member_sees_everything_including_private(org, about_public_field, founder):
    section = about_public_field.section
    OrgField.objects.create(section=section, key="secret", value="x", visibility=Visibility.PRIVATE)

    resolver = VisibilityResolver(viewer=founder, org=org)
    keys = {f.key for f in resolver.visible_fields()}

    assert keys == {"tagline", "secret"}


@pytest.mark.django_db
def test_private_never_leaks_to_non_member(org, about_public_field, outsider, verified_investor):
    section = about_public_field.section
    private_field = OrgField.objects.create(
        section=section, key="secret", value="x", visibility=Visibility.PRIVATE
    )

    for viewer in (None, outsider, verified_investor):
        resolver = VisibilityResolver(viewer=viewer, org=org)
        assert private_field.id not in {f.id for f in resolver.visible_fields()}


@pytest.mark.django_db
def test_restricted_field_needs_explicit_grant(org, outsider):
    section = _open_fundraise_section(org)
    mrr_field = OrgField.objects.create(section=section, key="mrr", value=50000)

    resolver = VisibilityResolver(viewer=outsider, org=org)
    assert mrr_field.id not in {f.id for f in resolver.visible_fields()}

    VisibilityGrant.objects.create(
        org=org,
        field=mrr_field,
        principal_type=VisibilityGrant.Principal.USER,
        principal_id=str(outsider.id),
    )
    resolver = VisibilityResolver(viewer=outsider, org=org)
    assert mrr_field.id in {f.id for f in resolver.visible_fields()}


@pytest.mark.django_db
def test_verified_investor_role_grant_on_section(org, verified_investor, outsider):
    section = _open_fundraise_section(org)
    ask_field = OrgField.objects.create(section=section, key="ask_amount", value=1000000)

    VisibilityGrant.objects.create(
        org=org,
        section=section,
        principal_type=VisibilityGrant.Principal.ROLE,
        principal_id="verified_investor",
    )

    resolver = VisibilityResolver(viewer=verified_investor, org=org)
    assert ask_field.id in {f.id for f in resolver.visible_fields()}

    resolver = VisibilityResolver(viewer=outsider, org=org)
    assert ask_field.id not in {f.id for f in resolver.visible_fields()}


@pytest.mark.django_db
def test_expired_grant_is_ignored(org, outsider):
    section = _open_fundraise_section(org)
    field = OrgField.objects.create(section=section, key="valuation", value=5000000)
    VisibilityGrant.objects.create(
        org=org,
        field=field,
        principal_type=VisibilityGrant.Principal.USER,
        principal_id=str(outsider.id),
        expires_at=now() - timedelta(days=1),
    )

    resolver = VisibilityResolver(viewer=outsider, org=org)
    assert field.id not in {f.id for f in resolver.visible_fields()}


@pytest.mark.django_db
def test_fundraise_sections_absent_when_not_fundraising(org, about_public_field, outsider):
    # org nunca abriu ronda: nenhuma secção fundraise deve existir
    kinds = set(org.sections.values_list("kind", flat=True))
    assert kinds == {
        SectionKind.ABOUT,
        SectionKind.TEAM,
        SectionKind.PRODUCTS,
        SectionKind.MARKET_THESIS,
        SectionKind.NEWS,
        SectionKind.MILESTONES,
        SectionKind.EVENTS,
        SectionKind.AWARDS,
        SectionKind.PRESS,
    }


@pytest.mark.django_db
def test_archived_fundraise_section_hidden_after_round_closes(org, verified_investor):
    section = _open_fundraise_section(org)
    field = OrgField.objects.create(section=section, key="valuation", value=5000000)
    VisibilityGrant.objects.create(
        org=org,
        section=section,
        principal_type=VisibilityGrant.Principal.ROLE,
        principal_id="verified_investor",
    )
    resolver = VisibilityResolver(viewer=verified_investor, org=org)
    assert field.id in {f.id for f in resolver.visible_fields()}

    section.archived_at = now()
    section.save()

    resolver = VisibilityResolver(viewer=verified_investor, org=org)
    assert field.id not in {f.id for f in resolver.visible_fields()}


@pytest.mark.django_db
def test_public_path_never_returns_restricted_or_private(org, about_public_field, verified_investor):
    from orgs.public import public_profile

    section = _open_fundraise_section(org)
    OrgField.objects.create(section=section, key="mrr", value=50000)  # restricted
    OrgField.objects.create(
        section=about_public_field.section, key="secret", value="x", visibility=Visibility.PRIVATE
    )
    VisibilityGrant.objects.create(
        org=org,
        section=section,
        principal_type=VisibilityGrant.Principal.ROLE,
        principal_id="verified_investor",
    )

    data = public_profile(org.slug)
    all_keys = {k for section_fields in data["sections"].values() for k in section_fields}

    assert "mrr" not in all_keys
    assert "secret" not in all_keys
    assert "tagline" in all_keys
