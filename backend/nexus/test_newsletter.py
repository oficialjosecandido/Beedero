"""Consent, audiences, sending in batches and unsubscribing."""

import pytest
from django.core import mail

from newsletter import audience
from newsletter.models import NewsletterDelivery, NewsletterRecipient, NewsletterSend
from newsletter.render import footer_for, render_markdown
from newsletter.sending import unsubscribe_token
from notifications.models import NotificationPreference


def opt_in(user):
    NotificationPreference.objects.update_or_create(user=user, defaults={"newsletter_opt_in": True})


@pytest.mark.django_db
def test_opting_in_is_recorded_with_its_moment(api, make_user):
    ana = make_user("ana")
    api.force_authenticate(ana)
    assert api.get("/api/notifications/preferences/").json()["newsletter_opt_in"] is False
    api.patch("/api/notifications/preferences/", {"newsletter_opt_in": True}, format="json")
    pref = NotificationPreference.objects.get(user=ana)
    assert pref.newsletter_opt_in and pref.newsletter_opt_in_at
    api.patch("/api/notifications/preferences/", {"newsletter_opt_in": False}, format="json")
    pref.refresh_from_db()
    assert pref.newsletter_opt_in_at is None


@pytest.mark.django_db
def test_the_newsletter_only_reaches_people_who_asked(make_user):
    yes = make_user("yes")
    opt_in(yes)
    make_user("no")
    tester = make_user("tester", is_internal=True)
    opt_in(tester)
    unconfirmed = make_user("unconfirmed", verified=False)
    opt_in(unconfirmed)
    gone = make_user("gone", is_active=False)
    opt_in(gone)
    NewsletterRecipient.objects.create(email="fan@example.org", source="landing waitlist")
    NewsletterRecipient.objects.create(email="NO@example.com", source="event")  # an account that didn't opt in
    NewsletterRecipient.objects.create(email="left@example.org", source="event", unsubscribed_at="2026-10-01T00:00Z")

    assert [r[0] for r in audience.recipients("subscribers")] == ["fan@example.org", "yes@example.com"]
    assert [r[0] for r in audience.recipients("contacts")] == ["fan@example.org"]
    # A service announcement goes to every account, opted in or not.
    assert {r[0] for r in audience.recipients("all_accounts")} == {"yes@example.com", "no@example.com"}
    labels = {row["key"]: row["label"] for row in audience.segment_counts()}
    assert labels["all_accounts"] == "All users"
    assert labels["org_owners"] == "All organisations"


@pytest.mark.django_db
def test_markdown_is_escaped_and_only_safe_links_survive():
    html = render_markdown("## Hi\n\n**Big** <script>x</script> [site](https://beedero.com) [bad](javascript:alert(1))\n\n- one\n- two")
    assert "<h2" in html and "<strong>Big</strong>" in html
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert 'href="https://beedero.com"' in html and "javascript:" not in html.split("[bad]")[0]
    assert "<ul" in html and html.count("<li>") == 2


def test_newsletter_footer_offers_unsubscribe_and_manage_preferences(settings):
    settings.FRONTEND_URL = "https://beedero.com"
    html = footer_for("newsletter", "https://beedero.com/unsubscribe/x")
    assert "Unsubscribe" in html and 'href="https://beedero.com/unsubscribe/x"' in html
    assert "Manage preferences" in html
    assert 'href="https://beedero.com/profile#email-preferences"' in html
    assert "Manage preferences" not in footer_for("announcement", None)


@pytest.fixture
def subscribers(make_user):
    users = [make_user(f"reader{i}") for i in range(30)]
    for user in users:
        opt_in(user)
    return users


def draft(as_admin, **fields):
    body = {"subject": "October at Beedero", "body": "Hello **world**.", "kind": "newsletter", "segment": "subscribers"}
    body.update(fields)
    return as_admin.post("/api/nexus/newsletter/", body, format="json").json()


@pytest.mark.django_db
def test_a_draft_shows_its_audience_and_a_real_preview(as_admin, subscribers):
    created = draft(as_admin)
    assert created["status"] == "draft"
    assert created["audience_count"] == 30
    assert "<strong>world</strong>" in created["preview_html"]
    # A segment of the other kind is dropped, not silently kept.
    changed = as_admin.patch(f"/api/nexus/newsletter/{created['id']}/", {"kind": "announcement"}, format="json").json()
    assert changed["segment"] == ""


@pytest.mark.django_db
def test_nothing_goes_out_if_the_audience_changed(as_admin, subscribers):
    created = draft(as_admin)
    response = as_admin.post(f"/api/nexus/newsletter/{created['id']}/send/", {"expected_count": 29}, format="json")
    assert response.status_code == 400
    assert NewsletterDelivery.objects.count() == 0
    assert NewsletterSend.objects.get().status == "draft"


@pytest.mark.django_db
def test_sending_goes_in_batches_and_never_twice(as_admin, subscribers):
    created = draft(as_admin)
    sent = as_admin.post(f"/api/nexus/newsletter/{created['id']}/send/", {"expected_count": 30}, format="json").json()
    assert sent["status"] == "sending"
    assert sent["progress"]["sent"] == 25 and sent["progress"]["pending"] == 5
    done = as_admin.post(f"/api/nexus/newsletter/{created['id']}/process/").json()
    assert done["status"] == "sent" and done["progress"]["sent"] == 30
    as_admin.post(f"/api/nexus/newsletter/{created['id']}/process/")
    assert len(mail.outbox) == 30
    assert len({m.to[0] for m in mail.outbox}) == 30
    first = mail.outbox[0]
    assert first.extra_headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert "/api/newsletter/unsubscribe/?token=" in first.extra_headers["List-Unsubscribe"]
    assert "/unsubscribe?token=" in first.alternatives[0][0]
    assert as_admin.post(f"/api/nexus/newsletter/{created['id']}/send/", {"expected_count": 30}).status_code == 400


@pytest.mark.django_db
def test_an_announcement_has_no_unsubscribe(as_admin, make_user):
    make_user("ana")
    created = draft(as_admin, kind="announcement", segment="all_accounts", subject="New subscription terms")
    count = created["audience_count"]
    as_admin.post(f"/api/nexus/newsletter/{created['id']}/send/", {"expected_count": count}, format="json")
    assert "List-Unsubscribe" not in mail.outbox[0].extra_headers
    assert "service announcement" in mail.outbox[0].alternatives[0][0]


@pytest.mark.django_db
def test_a_test_send_goes_only_to_the_admin(as_admin, admin, subscribers):
    created = draft(as_admin)
    as_admin.post(f"/api/nexus/newsletter/{created['id']}/test/")
    assert [m.to for m in mail.outbox] == [[admin.email]]
    assert mail.outbox[0].subject.startswith("[TEST]")


@pytest.mark.django_db
def test_one_click_unsubscribe(api, as_admin, subscribers):
    created = draft(as_admin)
    as_admin.post(f"/api/nexus/newsletter/{created['id']}/send/", {"expected_count": 30}, format="json")
    delivery = NewsletterDelivery.objects.filter(status="sent").first()
    api.force_authenticate(None)
    response = api.post(f"/api/newsletter/unsubscribe/?token={unsubscribe_token(delivery.id)}", "List-Unsubscribe=One-Click", content_type="application/x-www-form-urlencoded")
    assert response.status_code == 200
    assert NotificationPreference.objects.get(user=delivery.user).newsletter_opt_in is False
    assert len(audience.recipients("subscribers")) == 29
    assert api.post("/api/newsletter/unsubscribe/", {"token": "forged"}, format="json").status_code == 400


@pytest.mark.django_db
def test_contacts_need_a_source(as_admin):
    assert as_admin.post("/api/nexus/newsletter/contacts/", {"emails": "a@b.pt"}, format="json").status_code == 400
    result = as_admin.post(
        "/api/nexus/newsletter/contacts/", {"emails": "a@b.pt\nnot-an-email\nA@B.pt", "source": "Web Summit list"}, format="json"
    ).json()
    assert result == {"added": 1, "already_there": 1, "invalid": 1}


@pytest.mark.django_db
def test_the_old_admin_page_sends_people_to_the_nexus(client, admin, monkeypatch):
    monkeypatch.setattr("beedero.admin_access.KPI_ADMIN_EMAILS", {admin.email})
    client.force_login(admin)
    response = client.get("/admin/newsletter/")
    assert response.status_code == 302
    assert response["Location"].endswith("/beedero-nexus/newsletter")
