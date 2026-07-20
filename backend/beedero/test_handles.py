import pytest

from beedero.handles import compact_handle_base, unique_public_id


def test_compact_handle_base():
    assert compact_handle_base("Jose Candido") == "josecandido"
    assert compact_handle_base("Júlio Pomar") == "juliopomar"
    assert compact_handle_base("Ada Lovelace") == "adalovelace"


@pytest.mark.django_db
def test_unique_public_id_shared_between_people_and_orgs(db):
    from accounts.models import InvestorProfile, User
    from orgs.models import Organization

    user = User.objects.create_user(username="jose", email="jose@example.com", password="x")
    InvestorProfile.objects.create(user=user, full_name="Jose Candido", handle="josecandido")
    Organization.objects.create(slug="beedero", name="Beedero")

    assert unique_public_id("josecandido") == "josecandido2"
    assert unique_public_id("beedero") == "beedero2"
