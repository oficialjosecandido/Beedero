"""Test helpers shared across apps.

`unlock()` takes a bare test user past rungs 1–4 of the ladder
(accounts/ladder.py), so tests about Discover or connection requests start
from a person who is allowed to be found and to reach out. It only fills
what is blank — a test that set a city, a headline or a visibility keeps it.
"""

from django.utils import timezone

from .ladder import MIN_BIO_CHARS, MIN_SKILLS
from .models import InvestorProfile, SelfDeclaredExperience


def unlock(user, **profile_fields):
    if user.email_verified_at is None:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at"])

    profile, _ = InvestorProfile.objects.get_or_create(user=user)
    for field, value in profile_fields.items():
        setattr(profile, field, value)
    profile.full_name = profile.full_name or user.username.title()
    profile.headline = profile.headline or "Builder"
    profile.country = profile.country or "PT"
    profile.city = profile.city or "Lisboa"  # city_key is derived in save()
    profile.handle = profile.handle or f"{user.username}-{user.pk}".lower()
    profile.profile_picture = profile.profile_picture or "avatars/test.png"
    if len((profile.bio or "").strip()) < MIN_BIO_CHARS:
        profile.bio = "Building things with people I trust, in Lisbon, for a few years now. " * 2
    skills = profile.skills if isinstance(profile.skills, list) else []
    profile.skills = skills + [f"Skill {i}" for i in range(MIN_SKILLS - len(skills))]
    profile.save()

    if not SelfDeclaredExperience.objects.filter(user=user).exists():
        SelfDeclaredExperience.objects.create(
            user=user, org_name="Acme", role="Founder", started_on=timezone.now().date().replace(day=1)
        )
    return profile
