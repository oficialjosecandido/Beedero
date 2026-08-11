from datetime import timedelta

import pytest
from django.utils.timezone import now

from accounts.models import InvestorProfile, User
from orgs.constants import SectionKind
from orgs.models import (
    Activity,
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
    # LIVE by default: these are visibility tests, not onboarding tests, and
    # most of them exercise public/discovery paths that filter to LIVE orgs.
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


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
    # org has never opened a round: no fundraise section should exist
    kinds = set(org.sections.values_list("kind", flat=True))
    assert kinds == {
        SectionKind.ABOUT,
        SectionKind.TEAM,
        SectionKind.PRODUCTS,
        SectionKind.MARKET_THESIS,
        SectionKind.LINKS,
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
def test_public_profile_includes_team_members_with_public_handle(org, founder):
    from orgs.public import public_profile

    InvestorProfile.objects.create(
        user=founder,
        full_name="Ada Founder",
        headline="Founder",
        country="PT",
        handle="ada-founder",
    )

    data = public_profile(org.slug)

    assert len(data["team_members"]) == 1
    assert data["team_members"][0]["full_name"] == "Ada Founder"
    assert data["team_members"][0]["handle"] == "ada-founder"


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


@pytest.mark.django_db
def test_feed_respects_visibility(org, founder, outsider):
    from orgs.feed import activity_feed_items

    # visibility is a snapshot at Activity-creation time (§1), not re-derived
    # live from the section — the feed must still filter per-row rather than
    # assuming "activity == always public".
    public_post = Activity.objects.create(
        org=org, kind=SectionKind.NEWS, title="We launched!", occurred_at=now()
    )
    private_post = Activity.objects.create(
        org=org,
        kind=SectionKind.NEWS,
        title="not for outsiders",
        occurred_at=now(),
        visibility=Visibility.PRIVATE,
    )

    outsider_items = activity_feed_items(outsider, [org.id], [])
    assert {a.id for a in outsider_items} == {public_post.id}

    founder_items = activity_feed_items(founder, [org.id], [])
    assert {a.id for a in founder_items} == {public_post.id, private_post.id}

    member_items = activity_feed_items(founder, [], [])
    assert {a.id for a in member_items} == {public_post.id, private_post.id}


@pytest.mark.django_db
def test_org_create_auto_follows_owner(db):
    from rest_framework.test import APIClient

    from orgs.models import OrgFollow

    user = User.objects.create_user(username="creator", password="x")
    api = APIClient()
    api.force_authenticate(user)
    res = api.post("/api/orgs/", {"name": "New Co", "one_liner": "We ship"}, format="json")
    assert res.status_code == 201
    org = Organization.objects.get(slug=res.data["slug"])
    assert OrgFollow.objects.filter(user=user, org=org).exists()


@pytest.mark.django_db
def test_unfollow_org_removes_follow(db, org):
    from rest_framework.test import APIClient

    from orgs.models import OrgFollow

    user = User.objects.create_user(username="follower", password="x")
    OrgFollow.objects.create(user=user, org=org)
    api = APIClient()
    api.force_authenticate(user)
    res = api.delete(f"/api/orgs/{org.slug}/follow/")
    assert res.status_code == 204
    assert not OrgFollow.objects.filter(user=user, org=org).exists()


@pytest.mark.django_db
def test_unfollow_org_is_idempotent_when_not_following(db, org):
    from rest_framework.test import APIClient

    user = User.objects.create_user(username="nonfollower", password="x")
    api = APIClient()
    api.force_authenticate(user)
    res = api.delete(f"/api/orgs/{org.slug}/follow/")
    assert res.status_code == 204


@pytest.mark.django_db
def test_unfollow_user_removes_follow(db):
    from rest_framework.test import APIClient

    from orgs.models import UserFollow

    follower = User.objects.create_user(username="uf", password="x")
    followed = User.objects.create_user(username="followed", password="x")
    UserFollow.objects.create(follower=follower, followed=followed)
    api = APIClient()
    api.force_authenticate(follower)
    res = api.delete(f"/api/users/{followed.id}/follow/")
    assert res.status_code == 204
    assert not UserFollow.objects.filter(follower=follower, followed=followed).exists()


@pytest.mark.django_db
def test_unfollow_user_is_idempotent_when_not_following(db):
    from rest_framework.test import APIClient

    follower = User.objects.create_user(username="uf2", password="x")
    followed = User.objects.create_user(username="followed2", password="x")
    api = APIClient()
    api.force_authenticate(follower)
    res = api.delete(f"/api/users/{followed.id}/follow/")
    assert res.status_code == 204


@pytest.mark.django_db
def test_discovery_no_inference_leak(org, outsider, verified_investor):
    from orgs.discovery import discover

    section = _open_fundraise_section(org)
    OrgField.objects.create(section=section, key="mrr", value=999999)  # no grant yet

    # Unverified viewer: the restricted-metric filter must be ignored
    # entirely, not silently applied as "no match" — that would itself leak
    # information (a present-but-empty result implies "below threshold").
    results = discover(outsider, {"metric": "mrr", "metric_min": "100"})
    assert org in results

    # Verified investor, but no grant to this specific field: role alone
    # never implies visibility, so the org must not match even though the
    # underlying value would satisfy the threshold.
    results = discover(verified_investor, {"metric": "mrr", "metric_min": "100"})
    assert org not in results

    # Once genuinely granted, discovery can use it.
    VisibilityGrant.objects.create(
        org=org,
        section=section,
        principal_type=VisibilityGrant.Principal.ROLE,
        principal_id="verified_investor",
    )
    results = discover(verified_investor, {"metric": "mrr", "metric_min": "100"})
    assert org in results


def test_rls_policy_actually_enforced(db_app_role_connection):
    """P0.4: proves RLS is alive at the database level, independent of
    VisibilityResolver. Connects as the non-privileged `beedero_app` role and
    issues raw SQL — if the app were ever misconfigured to connect as a
    superuser (which bypasses RLS even with FORCE), this test fails.

    Uses `db_app_role_connection` (built on `transactional_db`, not `db`) so
    setup data is actually committed and visible to the separate raw
    connection — can't reuse the module's `org`/`outsider` fixtures, which
    depend on `db` and are mutually exclusive with `transactional_db`."""
    org = Organization.objects.create(slug="rls-proof-co", name="RLS Proof Co", is_fundraising=True)
    outsider = User.objects.create_user(username="rls-outsider", password="x")
    section = OrgSection.objects.create(org=org, kind=SectionKind.FINANCIALS)
    OrgField.objects.create(section=section, key="mrr", value=999999)  # restricted, no grant

    with db_app_role_connection.cursor() as c:
        c.execute("SELECT set_config('beedero.viewer_id', %s, false)", [str(outsider.id)])
        c.execute("SELECT count(*) FROM orgs_orgfield WHERE visibility = 'restricted'")
        assert c.fetchone()[0] == 0

        # Sanity check: a member of the org *does* see the restricted row via
        # the same raw path, proving the zero above is RLS filtering by
        # viewer, not e.g. a missing table or a connection to the wrong DB.
        OrgMembership.objects.create(org=org, user=outsider, role=OrgMembership.Role.MEMBER)
        c.execute("SELECT set_config('beedero.viewer_id', %s, false)", [str(outsider.id)])
        c.execute("SELECT count(*) FROM orgs_orgfield WHERE visibility = 'restricted'")
        assert c.fetchone()[0] == 1
