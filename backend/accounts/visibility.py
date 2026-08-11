"""Personal profile visibility — mirrors org field visibility at section level."""

from connections.services import are_connected

PUBLIC = "public"
VERIFIED_INVESTORS = "verified_investors"
CONNECTIONS = "connections"
PRIVATE = "private"

ALL_LEVELS = {PUBLIC, VERIFIED_INVESTORS, CONNECTIONS, PRIVATE}


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

    def _is_connected(self) -> bool:
        if not self.viewer or not self.viewer.is_authenticated:
            return False
        return are_connected(self.viewer, self.profile.user)

    def can_see(self, section: str) -> bool:
        if self._is_owner():
            return True
        level = self.profile.merged_visibility().get(section, PUBLIC)
        if level == PRIVATE:
            return False
        if level == VERIFIED_INVESTORS:
            return self._is_verified_investor()
        if level == CONNECTIONS:
            return self._is_connected()
        return True
