from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.milestones import check_org_anniversary_milestone
from orgs.models import Organization


class Command(BaseCommand):
    """Doc §5: the only milestone that isn't detectable at the moment of an
    event — it has to be checked daily against the calendar. The other four
    (followers, credibility level-up, round closed, first post) fire inline
    from the views/services that cause them."""

    help = "Checks org-anniversary milestones for today's date."

    def handle(self, *args, **options):
        today = timezone.localdate()
        checked = 0
        for org in Organization.objects.filter(status=Organization.Status.LIVE):
            check_org_anniversary_milestone(org, today)
            checked += 1
        self.stdout.write(self.style.SUCCESS(f"Checked anniversary milestones for {checked} org(s)."))
