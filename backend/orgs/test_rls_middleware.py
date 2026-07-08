from unittest.mock import patch

import pytest
from django.test import RequestFactory
from rest_framework.test import APIClient

from accounts.models import InvestorProfile, User
from orgs.constants import SectionKind
from orgs.middleware import RLSViewerMiddleware
from orgs.models import OrgField, Organization, OrgSection, Visibility, VisibilityGrant


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def outsider_with_grant(db, org):
    user = User.objects.create_user(username="grantee", password="x")
    section = org.sections.get(kind=SectionKind.ABOUT)
    field = OrgField.objects.create(
        section=section, key="secret", value="shh", visibility=Visibility.RESTRICTED
    )
    VisibilityGrant.objects.create(
        org=org, field=field, principal_type=VisibilityGrant.Principal.USER, principal_id=str(user.id)
    )
    return user


@pytest.mark.django_db
def test_middleware_skips_viewer_lookup_for_exempt_paths():
    middleware = RLSViewerMiddleware(get_response=lambda r: "ok")
    with patch("orgs.middleware._viewer_id") as mock_viewer_id:
        response = middleware(RequestFactory().post("/api/public/orgs/acme/"))
        assert response == "ok"
        mock_viewer_id.assert_not_called()


@pytest.mark.django_db
def test_middleware_resolves_viewer_for_non_exempt_paths():
    middleware = RLSViewerMiddleware(get_response=lambda r: "ok")
    with patch("orgs.middleware._viewer_id", return_value=0) as mock_viewer_id:
        response = middleware(RequestFactory().get("/api/orgs/acme/"))
        assert response == "ok"
        mock_viewer_id.assert_called_once()


@pytest.mark.django_db
def test_audit_log_failure_does_not_break_profile_read(api, org, outsider_with_grant):
    api.force_authenticate(outsider_with_grant)
    with patch(
        "orgs.serializers.RestrictedAccessLog.objects.bulk_create", side_effect=Exception("boom")
    ):
        res = api.get(f"/api/orgs/{org.slug}/")
    assert res.status_code == 200
    assert res.data["sections"][SectionKind.ABOUT]["secret"] == "shh"


@pytest.mark.django_db
def test_audit_log_written_on_restricted_field_read(api, org, outsider_with_grant):
    from orgs.models import RestrictedAccessLog

    api.force_authenticate(outsider_with_grant)
    res = api.get(f"/api/orgs/{org.slug}/")
    assert res.status_code == 200
    assert RestrictedAccessLog.objects.filter(org=org, viewer=outsider_with_grant, field_key="secret").exists()


@pytest.mark.django_db
def test_audit_log_failure_does_not_break_dataroom_read(api, org):
    org.is_fundraising = True
    org.save()
    section = OrgSection.objects.create(org=org, kind=SectionKind.DATA_ROOM)
    field = OrgField.objects.create(section=section, key="cap_table", value="doc.pdf")

    investor = User.objects.create_user(username="dr_investor", password="x")
    InvestorProfile.objects.create(user=investor, is_verified=True)
    VisibilityGrant.objects.create(
        org=org,
        field=field,
        principal_type=VisibilityGrant.Principal.USER,
        principal_id=str(investor.id),
    )

    api.force_authenticate(investor)
    with patch("orgs.views.RestrictedAccessLog.objects.bulk_create", side_effect=Exception("boom")):
        res = api.get(f"/api/orgs/{org.slug}/dataroom/")
    assert res.status_code == 200
    assert res.data["documents"]["cap_table"] == "doc.pdf"
