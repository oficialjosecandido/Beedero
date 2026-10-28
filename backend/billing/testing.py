"""Test helper: give an organisation a plan without going through checkout.

Most tests are about something else (Discover, posts, jobs) and only need the
organisation to be switched on; they get a complimentary plan.
"""

from .models import Subscription
from .subscriptions import grant_comp


def grant_plan(org) -> Subscription:
    return grant_comp(org)
