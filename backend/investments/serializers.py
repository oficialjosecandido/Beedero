from rest_framework import serializers

from orgs.serializers import _org_summary

from .models import InvestmentRecord


class InvestorDeclareSerializer(serializers.Serializer):
    org_slug = serializers.SlugField()
    round = serializers.IntegerField(required=False, allow_null=True, default=None)
    amount_cents = serializers.IntegerField(min_value=1)
    currency = serializers.CharField(max_length=3, required=False, default="EUR")
    invested_on = serializers.DateField()
    instrument = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    investor_public_intent = serializers.BooleanField(required=False, default=False)
    amount_public_intent = serializers.BooleanField(required=False, default=False)


class StartupDeclareSerializer(serializers.Serializer):
    handle = serializers.SlugField(required=False, allow_null=True, default=None)
    investor_external_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    round = serializers.IntegerField(required=False, allow_null=True, default=None)
    amount_cents = serializers.IntegerField(min_value=1)
    currency = serializers.CharField(max_length=3, required=False, default="EUR")
    invested_on = serializers.DateField()
    instrument = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    amount_public_intent = serializers.BooleanField(required=False, default=False)


class InvestmentConfirmSerializer(serializers.Serializer):
    investor_public_intent = serializers.BooleanField(required=False, default=None, allow_null=True)
    amount_public_intent = serializers.BooleanField(required=False, default=False)


def _investor_summary(record: InvestmentRecord) -> dict:
    if record.investor_user_id:
        profile = getattr(record.investor_user, "investorprofile", None)
        return {
            "name": profile.full_name if profile and profile.full_name else record.investor_user.email.split("@", 1)[0],
            "handle": profile.handle if profile else None,
            "is_external": False,
        }
    return {"name": record.investor_external_name, "handle": None, "is_external": True}


def investment_summary(record: InvestmentRecord) -> dict:
    return {
        "id": record.id,
        "org": _org_summary(record.org),
        "round_id": record.round_id,
        "investor": _investor_summary(record),
        "amount_cents": record.amount_cents,
        "currency": record.currency,
        "invested_on": record.invested_on.isoformat(),
        "instrument": record.instrument,
        "status": record.status,
        "declarer_side": record.declarer_side,
        "confirmed_at": record.confirmed_at.isoformat() if record.confirmed_at else None,
        "investor_public": record.investor_public,
        "amount_public": record.amount_public,
        "created_at": record.created_at.isoformat(),
    }
