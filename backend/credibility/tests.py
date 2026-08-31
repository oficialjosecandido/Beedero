from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orgs.constants import SectionKind
from orgs.models import Organization, OrgMembership

from .credential_services import approve_credential, reject_credential, submit_credential, verified_credentials_payload
from .levels import credibility_level
from .models import ProfessionalCredential, Verification, VerificationType
from .nif import nif_is_valid
from .services import approve_verification, reject_verification, submit_verification

VALID_NIF = "500000000"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def org(db):
    return Organization.objects.create(slug="acme", name="Acme", status=Organization.Status.LIVE)


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", email="owner@example.com", password="x")
    OrgMembership.objects.create(org=org, user=user, role=OrgMembership.Role.OWNER)
    return user


@pytest.fixture
def outsider(db):
    return User.objects.create_user(username="outsider", email="outsider@example.com", password="x")


def _verify(org, type_, valid_until=None, payload=None):
    return Verification.objects.create(
        org=org,
        type=type_,
        status=Verification.Status.VERIFIED,
        payload=payload or {},
        valid_until=valid_until,
    )


class TestNif:
    def test_valid_company_nif(self):
        assert nif_is_valid(VALID_NIF) is True

    def test_wrong_check_digit(self):
        assert nif_is_valid("500000001") is False

    def test_wrong_length(self):
        assert nif_is_valid("5000000") is False

    def test_individual_prefix_rejected(self):
        # doc §2 only verifies org identity, not individual NIFs — prefix 1/2/3 are people.
        assert nif_is_valid("123456789") is False

    def test_non_digit_input(self):
        assert nif_is_valid("abcdefghi") is False


class TestCredibilityLevel:
    def test_no_verifications_is_level_zero(self, org):
        assert credibility_level(org) == 0

    def test_level_1_requires_both_identity_types(self, org):
        _verify(org, VerificationType.COMPANY_REGISTRY)
        assert credibility_level(org) == 0
        _verify(org, VerificationType.FOUNDER_ROLE)
        assert credibility_level(org) == 1

    def test_levels_are_strictly_sequential(self, org):
        # Level 3 without level 2 must still report as level 1 — doc §1's
        # deliberate note, not an oversight.
        _verify(org, VerificationType.COMPANY_REGISTRY)
        _verify(org, VerificationType.FOUNDER_ROLE)
        _verify(org, VerificationType.ANNUAL_ACCOUNTS)
        assert credibility_level(org) == 1

    def test_full_ladder_to_level_3(self, org):
        _verify(org, VerificationType.COMPANY_REGISTRY)
        _verify(org, VerificationType.FOUNDER_ROLE)
        _verify(org, VerificationType.TAX_CLEARANCE)
        _verify(org, VerificationType.SS_CLEARANCE)
        _verify(org, VerificationType.ANNUAL_ACCOUNTS)
        assert credibility_level(org) == 3

    def test_level_4_is_any_of_not_all_of(self, org):
        _verify(org, VerificationType.COMPANY_REGISTRY)
        _verify(org, VerificationType.FOUNDER_ROLE)
        _verify(org, VerificationType.TAX_CLEARANCE)
        _verify(org, VerificationType.SS_CLEARANCE)
        _verify(org, VerificationType.ANNUAL_ACCOUNTS)
        _verify(org, VerificationType.STRIPE_TRACTION)
        assert credibility_level(org) == 4

    def test_expired_verification_does_not_count(self, org):
        _verify(org, VerificationType.COMPANY_REGISTRY, valid_until=timezone.now() - timedelta(days=1))
        _verify(org, VerificationType.FOUNDER_ROLE)
        assert credibility_level(org) == 0

    def test_expiry_silently_regresses_the_level(self, org):
        _verify(org, VerificationType.COMPANY_REGISTRY)
        _verify(org, VerificationType.FOUNDER_ROLE)
        _verify(org, VerificationType.TAX_CLEARANCE)
        _verify(org, VerificationType.SS_CLEARANCE, valid_until=timezone.now() - timedelta(days=1))
        assert credibility_level(org) == 1


@pytest.mark.django_db
class TestSubmitVerification:
    def test_invalid_nif_rejected(self, org, owner):
        with pytest.raises(ValidationError):
            submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": "000000000"}, {})

    def test_valid_submission_creates_pending_row(self, org, owner):
        v = submit_verification(
            org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {}
        )
        assert v.status == Verification.Status.PENDING
        assert v.payload["nif"] == VALID_NIF

    def test_resubmission_reuses_pending_row(self, org, owner):
        first = submit_verification(
            org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {}
        )
        second = submit_verification(
            org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {}
        )
        assert first.id == second.id
        assert Verification.objects.filter(org=org, type=VerificationType.COMPANY_REGISTRY).count() == 1

    def test_new_submission_after_rejection_starts_fresh_row(self, org, owner):
        first = submit_verification(
            org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {}
        )
        reject_verification(first, reviewer=owner, reason="bad doc")
        second = submit_verification(
            org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {}
        )
        assert second.id != first.id
        assert Verification.objects.filter(org=org, type=VerificationType.COMPANY_REGISTRY).count() == 2


@pytest.mark.django_db
class TestApproveReject:
    def test_approve_sets_verified_and_valid_until(self, org, owner):
        v = submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {})
        approve_verification(v, reviewer=owner)
        v.refresh_from_db()
        assert v.status == Verification.Status.VERIFIED
        assert v.valid_until is not None

    def test_approve_is_idempotent(self, org, owner):
        v = submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {})
        approve_verification(v, reviewer=owner)
        first_valid_until = v.valid_until
        approve_verification(v, reviewer=owner)
        v.refresh_from_db()
        assert v.valid_until == first_valid_until

    def test_reject_sets_reason(self, org, owner):
        v = submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {})
        reject_verification(v, reviewer=owner, reason="doc unreadable")
        v.refresh_from_db()
        assert v.status == Verification.Status.REJECTED
        assert v.rejection_reason == "doc unreadable"

    def test_annual_accounts_approval_writes_restricted_financial_fields(self, org, owner):
        v = submit_verification(
            org,
            owner,
            VerificationType.ANNUAL_ACCOUNTS,
            {"fiscal_year": "2024", "revenue_fy": "100000", "occ_number": "12345"},
            {},
        )
        approve_verification(v, reviewer=owner)
        section = org.sections.get(kind=SectionKind.CERTIFIED_FINANCIALS)
        field = section.fields.get(key="revenue_fy")
        assert field.value == "100000"


@pytest.mark.django_db
class TestNifAntiAbuse:
    def test_same_verified_nif_cannot_belong_to_two_orgs(self, owner):
        org_a = Organization.objects.create(slug="org-a", name="Org A", status=Organization.Status.LIVE)
        org_b = Organization.objects.create(slug="org-b", name="Org B", status=Organization.Status.LIVE)
        Verification.objects.create(
            org=org_a,
            type=VerificationType.COMPANY_REGISTRY,
            status=Verification.Status.VERIFIED,
            payload={"nif": VALID_NIF},
        )
        with pytest.raises(Exception):
            Verification.objects.create(
                org=org_b,
                type=VerificationType.COMPANY_REGISTRY,
                status=Verification.Status.VERIFIED,
                payload={"nif": VALID_NIF},
            )


@pytest.mark.django_db
class TestCredibilityView:
    def test_outsider_sees_only_verified_badges(self, api, org, owner, outsider):
        v = submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {})
        approve_verification(v, reviewer=owner)
        submit_verification(org, owner, VerificationType.FOUNDER_ROLE, {}, {})

        api.force_authenticate(outsider)
        res = api.get(f"/api/orgs/{org.slug}/credibility/")
        assert res.status_code == 200
        assert res.data["level"] == 0  # founder_role still pending, so level 1 not reached
        assert VerificationType.COMPANY_REGISTRY in res.data["verifications"]
        assert VerificationType.FOUNDER_ROLE not in res.data["verifications"]

    def test_member_sees_full_detail_including_rejection_reason(self, api, org, owner):
        v = submit_verification(org, owner, VerificationType.COMPANY_REGISTRY, {"nif": VALID_NIF}, {})
        reject_verification(v, reviewer=owner, reason="mismatch")

        api.force_authenticate(owner)
        res = api.get(f"/api/orgs/{org.slug}/credibility/")
        assert res.data["verifications"][VerificationType.COMPANY_REGISTRY]["rejection_reason"] == "mismatch"


@pytest.mark.django_db
class TestVerificationSubmitView:
    def test_owner_can_submit(self, api, org, owner):
        api.force_authenticate(owner)
        res = api.post(
            f"/api/orgs/{org.slug}/verifications/",
            {"type": VerificationType.COMPANY_REGISTRY, "nif": VALID_NIF},
        )
        assert res.status_code == 201
        assert Verification.objects.filter(org=org, type=VerificationType.COMPANY_REGISTRY).exists()

    def test_outsider_cannot_submit(self, api, org, outsider):
        api.force_authenticate(outsider)
        res = api.post(
            f"/api/orgs/{org.slug}/verifications/",
            {"type": VerificationType.COMPANY_REGISTRY, "nif": VALID_NIF},
        )
        assert res.status_code == 403

    def test_invalid_type_rejected(self, api, org, owner):
        api.force_authenticate(owner)
        res = api.post(f"/api/orgs/{org.slug}/verifications/", {"type": "not_a_real_type"})
        assert res.status_code == 400

    def test_invalid_nif_returns_400(self, api, org, owner):
        api.force_authenticate(owner)
        res = api.post(
            f"/api/orgs/{org.slug}/verifications/",
            {"type": VerificationType.COMPANY_REGISTRY, "nif": "000000000"},
        )
        assert res.status_code == 400


@pytest.mark.django_db
class TestTractionConnectStub:
    def test_stub_grants_verified_stripe_traction(self, api, org, owner):
        api.force_authenticate(owner)
        res = api.post(f"/api/orgs/{org.slug}/traction/connect/")
        assert res.status_code == 200
        assert res.data["stub"] is True
        v = Verification.objects.get(org=org, type=VerificationType.STRIPE_TRACTION)
        assert v.status == Verification.Status.VERIFIED

    def test_calling_twice_refreshes_validity_without_duplicating(self, api, org, owner):
        api.force_authenticate(owner)
        api.post(f"/api/orgs/{org.slug}/traction/connect/")
        api.post(f"/api/orgs/{org.slug}/traction/connect/")
        assert Verification.objects.filter(org=org, type=VerificationType.STRIPE_TRACTION).count() == 1


@pytest.mark.django_db
class TestProfessionalCredential:
    def test_submit_creates_pending_row(self, outsider):
        c = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        assert c.status == ProfessionalCredential.Status.PENDING
        assert c.title == "Psychotherapist"

    def test_resubmission_reuses_pending_row(self, outsider):
        first = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        second = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        assert first.id == second.id
        assert ProfessionalCredential.objects.filter(user=outsider).count() == 1

    def test_new_submission_after_rejection_starts_fresh_row(self, outsider):
        first = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        reject_credential(first, reviewer=outsider, reason="bad doc")
        second = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        assert second.id != first.id
        assert ProfessionalCredential.objects.filter(user=outsider).count() == 2

    def test_approve_sets_verified(self, outsider):
        c = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        approve_credential(c, reviewer=outsider)
        c.refresh_from_db()
        assert c.status == ProfessionalCredential.Status.VERIFIED
        assert c.verified_at is not None

    def test_approve_is_idempotent(self, outsider):
        c = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        approve_credential(c, reviewer=outsider)
        first_verified_at = c.verified_at
        approve_credential(c, reviewer=outsider)
        c.refresh_from_db()
        assert c.verified_at == first_verified_at

    def test_reject_sets_reason(self, outsider):
        c = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        reject_credential(c, reviewer=outsider, reason="doc unreadable")
        c.refresh_from_db()
        assert c.status == ProfessionalCredential.Status.REJECTED
        assert c.rejection_reason == "doc unreadable"

    def test_verified_credentials_payload_states_exact_facts(self, outsider):
        c = submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        approve_credential(c, reviewer=outsider)
        payload = verified_credentials_payload(outsider)
        assert payload == [
            {
                "title": "Psychotherapist",
                "issuer": "Ordem dos Psicólogos",
                "identifier": "12345",
                "verified_at": c.verified_at.date().isoformat(),
            }
        ]

    def test_pending_credential_not_in_payload(self, outsider):
        submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        assert verified_credentials_payload(outsider) == []

    def test_same_verified_issuer_identifier_cannot_verify_for_two_users(self, outsider, owner):
        ProfessionalCredential.objects.create(
            user=outsider,
            title="Psychotherapist",
            issuer="Ordem dos Psicólogos",
            identifier="12345",
            status=ProfessionalCredential.Status.VERIFIED,
        )
        with pytest.raises(Exception):
            ProfessionalCredential.objects.create(
                user=owner,
                title="Psychotherapist",
                issuer="Ordem dos Psicólogos",
                identifier="12345",
                status=ProfessionalCredential.Status.VERIFIED,
            )


@pytest.mark.django_db
class TestProfessionalCredentialViews:
    def test_authenticated_user_can_submit(self, api, outsider):
        api.force_authenticate(outsider)
        res = api.post(
            "/api/credentials/",
            {"title": "Psychotherapist", "issuer": "Ordem dos Psicólogos", "identifier": "12345"},
        )
        assert res.status_code == 201
        assert ProfessionalCredential.objects.filter(user=outsider).exists()

    def test_anonymous_cannot_submit(self, api):
        res = api.post(
            "/api/credentials/",
            {"title": "Psychotherapist", "issuer": "Ordem dos Psicólogos", "identifier": "12345"},
        )
        assert res.status_code == 401

    def test_missing_fields_rejected(self, api, outsider):
        api.force_authenticate(outsider)
        res = api.post("/api/credentials/", {"title": "Psychotherapist"})
        assert res.status_code == 400

    def test_mine_lists_all_statuses(self, api, outsider):
        submit_credential(outsider, title="Psychotherapist", issuer="Ordem dos Psicólogos", identifier="12345")
        api.force_authenticate(outsider)
        res = api.get("/api/credentials/mine/")
        assert res.status_code == 200
        assert len(res.data) == 1
        assert res.data[0]["status"] == "pending"


@pytest.mark.django_db
class TestDiscoveryCredibilityFilter:
    def test_min_credibility_filters_out_unverified_orgs(self, api, owner):
        from orgs import discovery

        Organization.objects.create(slug="low", name="Low", status=Organization.Status.LIVE)
        high = Organization.objects.create(slug="high", name="High", status=Organization.Status.LIVE)
        _verify(high, VerificationType.COMPANY_REGISTRY)
        _verify(high, VerificationType.FOUNDER_ROLE)

        qs = discovery.discover(owner, {"min_credibility": "1"})
        slugs = {o.slug for o in qs}
        assert slugs == {"high"}
        assert "low" not in slugs
