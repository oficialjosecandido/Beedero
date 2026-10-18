"""Endpoints for the person's three-step onboarding — doc §6.3 and §6.4.

Kept out of `accounts/views.py` because this is one short-lived flow with one
reader, and the rules that make it correct (the handle is editable here only,
the intents never leave this pair of endpoints) are easier to hold in view
when they are not three hundred lines apart.

There are no write endpoints for the suggestions: following an org is
`POST /api/orgs/<slug>/follow/` and asking to connect is
`POST /api/connections/requests/`, both of which already exist, carry their own
limits and notifications, and are the same calls the rest of the product makes.
A second path into either would be a second set of rules to keep in step.
"""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import onboarding
from .intents import Intent


def _person_card(profile) -> dict:
    return {
        # The id as well as the handle: POST /api/connections/requests/ takes
        # `recipient_id`, and the card's only action is to send one.
        "user_id": profile.user_id,
        "handle": profile.handle,
        "name": profile.full_name,
        "headline": profile.headline,
        "city": profile.city,
        "avatar": profile.profile_picture.url if profile.profile_picture else None,
        "is_verified": profile.is_verified,
        "skills": [s for s in (profile.skills or []) if isinstance(s, str)][:4],
    }


def _org_card(org, is_local: bool) -> dict:
    return {
        "slug": org.slug,
        "name": org.name,
        "one_liner": org.one_liner,
        "logo": org.logo.url if org.logo else None,
        "is_verified": org.is_verified,
        "sector": org.sector,
        # True when somebody on this team declared the viewer's city; False for
        # the fallback that keeps a quiet city's screen from being empty.
        "is_local": is_local,
    }


class OnboardingView(APIView):
    """GET/POST /api/onboarding/ — read the state, or save one step.

    One endpoint for all three steps, keyed by `step`, rather than three. The
    steps write to the same row and share the same validation; splitting them
    would mean three views that each had to know what the other two had done.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(onboarding.state(request.user))

    def post(self, request):
        step = request.data.get("step")
        try:
            if step == "identity":
                data = onboarding.save_identity(
                    request.user,
                    full_name=str(request.data.get("full_name") or ""),
                    handle=str(request.data.get("handle") or ""),
                    city=str(request.data.get("city") or ""),
                    headline=str(request.data.get("headline") or ""),
                )
            elif step == "intents":
                data = onboarding.save_intents(request.user, request.data.get("intents"))
            elif step == "complete":
                data = onboarding.complete(request.user)
            else:
                return Response(
                    {"detail": "Unknown onboarding step."}, status=status.HTTP_400_BAD_REQUEST
                )
        except onboarding.OnboardingError as err:
            # Keyed by field when there is one, so the form can put the message
            # under the input that caused it; `detail` as well, because every
            # other error in this API is read from there.
            body = {"detail": str(err)}
            if err.field:
                body[err.field] = [str(err)]
            return Response(body, status=status.HTTP_400_BAD_REQUEST)

        return Response(data)


class OnboardingIntentOptionsView(APIView):
    """GET /api/onboarding/intents/ — the closed vocabulary, with labels.

    Served rather than duplicated in the client so the five options cannot
    drift apart from `accounts/intents.py`, which is what routes on them.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {"items": [{"value": value, "label": label} for value, label in Intent.choices]}
        )


class OnboardingSuggestionsView(APIView):
    """GET /api/onboarding/suggestions/ — §6.3's five follows."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = onboarding.suggestions(request.user)
        return Response(
            {
                "city": data["city"],
                "is_local": data["is_local"],
                "orgs": [_org_card(org, is_local) for org, is_local in data["orgs"]],
                "people": [_person_card(profile) for profile in data["people"]],
            }
        )
