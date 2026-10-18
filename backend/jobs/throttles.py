"""The rate limit on the public job endpoints.

§9 of `beedero-aquisicao-pessoas.md` requires it: "Endpoints públicos de vagas
com limite por IP e só campos públicos."

Worth being honest about what it can and cannot do here, because the same repo
argues the opposite case next door. `orgs/public_seo_views.py` deliberately has
no IP throttle, on the grounds that its callers are all `publicFetch` from the
Next server, so the backend sees one IP for the whole public site and an IP
limit would be a limit on Beedero rather than on a scraper.

That reasoning holds for this endpoint too, with one difference that makes the
throttle worth having anyway: these two endpoints are the only public ones that
return a *list of other people's open positions*, which is the one thing on the
site somebody would want to harvest wholesale, and they are reachable directly
at the API host, not only through the Next pages.

So the limit is sized for the shape of the traffic rather than for the number
of visitors. The pages that call these endpoints are server-rendered and cached
(`publicFetch(path, 300)`), which means the frontend's own request rate is
bounded by cache misses — roughly one request per distinct URL per five minutes
— not by how many people are reading. A rate that a popular public site cannot
reach by being popular, and that a scraper walking every job meets within the
first minute, is therefore the same number.

If the public pages are ever changed to fetch uncached, this number stops being
safe: it is one bucket for the frontend host, and the protection against a
self-inflicted 429 is the cache in front of it.
"""

import hashlib

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class PublicJobsThrottle(SimpleRateThrottle):
    scope = "public_jobs"
    rate = "600/hour"

    def get_cache_key(self, request, view):
        # Hashed and salted, like affiliations/throttles.py: the cache is a
        # shared table, and IPs in key names would make it a visitor log.
        ident = self.get_ident(request)
        digest = hashlib.sha256(
            f"{settings.SECRET_KEY}:{self.scope}:{ident}".encode()
        ).hexdigest()[:32]
        return f"throttle_{self.scope}_{digest}"
