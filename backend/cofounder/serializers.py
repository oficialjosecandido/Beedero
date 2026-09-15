from rest_framework import serializers

from accounts.models import InvestorProfile
from accounts.skills import normalize_skills
from connections.serializers import user_summary

from .models import PROMPT_KEYS, PROMPT_MAX_LENGTH, BuilderProfile, CofounderMatch, Strength

MAX_SECTORS = 5
SECTOR_MAX_LENGTH = 50


def _clean_list(raw, *, max_items: int, max_length: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in raw:
        value = str(value).strip()[:max_length]
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            out.append(value)
    return out[:max_items]


class BuilderProfileSerializer(serializers.ModelSerializer):
    """Own-profile read/write. `is_active` is writable — opting in and out is
    the whole point — but the view runs services.activate_profile() first, so
    a half-finished card can't go live."""

    is_complete = serializers.BooleanField(read_only=True)

    class Meta:
        model = BuilderProfile
        fields = [
            "is_active",
            "adult_confirmed",
            "primary_strength",
            "looking_for",
            "commitment",
            "sectors",
            "has_idea",
            "idea_pitch",
            "prompts",
            "is_complete",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_looking_for(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        valid = set(Strength.values)
        cleaned = [v for v in dict.fromkeys(str(v).strip() for v in value) if v in valid]
        if not cleaned and value:
            raise serializers.ValidationError("Unknown option.")
        return cleaned

    def validate_sectors(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        return _clean_list(value, max_items=MAX_SECTORS, max_length=SECTOR_MAX_LENGTH)

    def validate_prompts(self, value):
        """Fixed keys, free text. Unknown keys are dropped rather than
        rejected so an older client can't be locked out by a newer one."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Expected an object.")
        cleaned = {}
        for key in PROMPT_KEYS:
            text = str(value.get(key, "") or "").strip()
            if len(text) > PROMPT_MAX_LENGTH:
                raise serializers.ValidationError(
                    {key: f"Keep it under {PROMPT_MAX_LENGTH} characters."}
                )
            if text:
                cleaned[key] = text
        return cleaned

    def validate(self, attrs):
        has_idea = attrs.get("has_idea", getattr(self.instance, "has_idea", False))
        if not has_idea:
            attrs["idea_pitch"] = ""
        return attrs


class InterestSerializer(serializers.Serializer):
    target_id = serializers.IntegerField()
    # Explicit: "Interested" and "Pass" are two named buttons, not a gesture
    # whose direction the client infers.
    liked = serializers.BooleanField()


class OutcomeSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=CofounderMatch.Outcome.choices)


class CreateOrgSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    one_liner = serializers.CharField(max_length=140, required=False, allow_blank=True, default="")


def _profile(user) -> InvestorProfile | None:
    try:
        return user.investorprofile
    except InvestorProfile.DoesNotExist:
        return None


def builder_card(builder: BuilderProfile) -> dict:
    """A deck card. Credibility first (doc §6): user_summary already carries
    the verification seal, reputation tier and platform attestations, and the
    card reuses it rather than inventing a parallel identity payload. Skills
    and country are read from the personal profile — never re-entered here."""
    profile = _profile(builder.user)
    return {
        **user_summary(builder.user),
        "is_verified": bool(profile and profile.is_verified),
        "country": profile.country if profile else "",
        "skills": normalize_skills(profile.skills or []) if profile else [],
        "primary_strength": builder.primary_strength,
        "primary_strength_label": (
            Strength(builder.primary_strength).label if builder.primary_strength else ""
        ),
        "looking_for": builder.looking_for or [],
        "commitment": builder.commitment,
        "commitment_label": (
            BuilderProfile.Commitment(builder.commitment).label if builder.commitment else ""
        ),
        "sectors": builder.sectors or [],
        "has_idea": builder.has_idea,
        "idea_pitch": builder.idea_pitch,
        "prompts": builder.prompts or {},
    }


def match_summary(match: CofounderMatch, viewer) -> dict:
    other = match.other_user(viewer)
    builder = getattr(other, "builder", None)
    return {
        "id": match.id,
        "other": builder_card(builder) if builder else user_summary(other),
        "outcome": match.outcome,
        "outcome_label": CofounderMatch.Outcome(match.outcome).label,
        # The chat is the ordinary DM thread — the client links into
        # /messages rather than rendering a second inbox.
        "conversation_id": match.conversation_id,
        "org": (
            {"slug": match.org.slug, "name": match.org.name} if match.org_id and match.org else None
        ),
        "created_at": match.created_at.isoformat(),
    }
