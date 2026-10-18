"""The smallest profile somebody can apply for a job with — doc §3.5.

"Quem chega por uma vaga não deve ter de preencher o perfil inteiro antes de se
candidatar. Perfil mínimo: nome, cidade, título curto, link opcional
(LinkedIn/portefólio) e nota."

Three of those four are profile fields and are written here; the link and the
note belong to the application itself, since they are what this org is being
told rather than what the person is publishing. §3.5's list is the shape of the
*form*, not a list of columns to fill.

The rule throughout: fill blanks, never overwrite. Someone who already has a
name and a headline is applying with the profile they chose, and an apply form
that quietly rewrote it would be a profile editor in disguise.
"""

from .models import InvestorProfile

MAX_NAME = 200
MAX_HEADLINE = 200
MAX_CITY = 80


def fill_minimum_profile(user, *, full_name: str = "", city: str = "", headline: str = "") -> bool:
    """Fill whichever of the three the person left blank. True if anything changed.

    Creates the profile row if it is missing: a user without one has never
    opened their profile, which is exactly the person §3.5 is about.
    """
    profile, _ = InvestorProfile.objects.get_or_create(user=user)

    updates = {}
    if full_name.strip() and not profile.full_name:
        updates["full_name"] = full_name.strip()[:MAX_NAME]
    if headline.strip() and not profile.headline:
        updates["headline"] = headline.strip()[:MAX_HEADLINE]
    if city.strip() and not profile.city:
        # `city_key` is derived in InvestorProfile.save(), which adds it to
        # update_fields itself — so "city" alone here is correct and the
        # normalized form cannot drift.
        updates["city"] = city.strip()[:MAX_CITY]

    if not updates:
        return False

    for field, value in updates.items():
        setattr(profile, field, value)
    profile.save(update_fields=list(updates))
    return True
