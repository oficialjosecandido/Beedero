"""Personal profile visibility — mirrors org field visibility at section level."""

PUBLIC = "public"
VERIFIED_INVESTORS = "verified_investors"
PRIVATE = "private"

ALL_LEVELS = {PUBLIC, VERIFIED_INVESTORS, PRIVATE}


class PersonVisibilityResolver:
    def __init__(self, profile, viewer):
        self.profile = profile
        self.viewer = viewer

    def _is_owner(self) -> bool:
        return self.viewer is not None and self.viewer.is_authenticated and self.viewer.id == self.profile.user_id

    def _is_verified_investor(self) -> bool:
        if not self.viewer or not self.viewer.is_authenticated:
            return False
        investor = getattr(self.viewer, "investorprofile", None)
        return bool(investor and investor.is_verified)

    def can_see(self, section: str) -> bool:
        if self._is_owner():
            return True
        level = self.profile.merged_visibility().get(section, PUBLIC)
        if level == PRIVATE:
            return False
        if level == VERIFIED_INVESTORS:
            return self._is_verified_investor()
        return True
