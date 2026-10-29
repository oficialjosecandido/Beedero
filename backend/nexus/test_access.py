"""Who gets in: admins everywhere, staff to the queues, everyone else 404."""

import pytest

from accounts.models import User
from nexus.access import ADMIN, STAFF, nexus_role

STAFF_GETS = ["/api/nexus/me/", "/api/nexus/home/", "/api/nexus/users/", "/api/nexus/orgs/", "/api/nexus/posts/", "/api/nexus/reports/"]
ADMIN_GETS = ["/api/nexus/overview/", "/api/nexus/billing/", "/api/nexus/newsletter/", "/api/nexus/newsletter/contacts/", "/api/nexus/audit/"]


def test_the_real_allowlist_is_the_admin_list(monkeypatch):
    monkeypatch.undo()
    for email in ("josevcandido@gmail.com", "PT.bidnow@gmail.com"):
        assert nexus_role(User(email=email, is_staff=True, is_active=True)) == ADMIN
    assert nexus_role(User(email="josevcandido@gmail.com", is_staff=False, is_active=True)) is None
    assert nexus_role(User(email="someone@beedero.com", is_staff=True, is_active=True)) == STAFF


@pytest.mark.django_db
@pytest.mark.parametrize("url", STAFF_GETS + ADMIN_GETS)
def test_everyone_else_gets_a_404(api, make_user, url):
    assert api.get(url).status_code == 404  # signed out
    api.force_authenticate(make_user("ana"))
    assert api.get(url).status_code == 404  # signed in, not staff


@pytest.mark.django_db
def test_the_allowlist_alone_is_not_enough(api, make_user):
    api.force_authenticate(make_user("boss", email="admin@beedero.test"))  # not is_staff
    assert api.get("/api/nexus/overview/").status_code == 404


@pytest.mark.django_db
def test_a_suspended_admin_is_out(api, admin):
    admin.is_active = False
    admin.save()
    api.force_authenticate(admin)
    assert api.get("/api/nexus/me/").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("url", STAFF_GETS)
def test_staff_open_the_queues(as_staff, url):
    assert as_staff.get(url).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("url", ADMIN_GETS)
def test_staff_do_not_see_kpis_money_newsletter_or_audit(as_staff, url):
    assert as_staff.get(url).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("url", STAFF_GETS + ADMIN_GETS)
def test_admins_see_everything(as_admin, url):
    assert as_admin.get(url).status_code == 200


@pytest.mark.django_db
def test_me_says_the_role_and_what_it_allows(as_staff):
    body = as_staff.get("/api/nexus/me/").json()
    assert body["role"] == "staff"
    assert "posts" in body["capabilities"] and "overview" not in body["capabilities"]
