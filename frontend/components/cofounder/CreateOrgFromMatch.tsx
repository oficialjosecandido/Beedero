import Link from "next/link";

import type { CofounderMatch } from "@/lib/cofounder-options";

/** Doc §6: the funnel closes here. Everything before this is conversation —
 * this is the point where a match becomes something real on Beedero, which
 * is why it's a first-class action on the match and not buried in a menu.
 *
 * The organisation is created on /orgs/new, carrying the match: there is one
 * way to create an organisation and it chooses a plan, this one included. The
 * other founder is invited as an owner once it exists.
 *
 * It arrives as a startup (`?kind=startup`): two people who have just met to
 * build something have no company yet. The form still asks, so a pair who
 * already incorporated can say so. */
export function CreateOrgFromMatch({ match }: { match: CofounderMatch }) {
  return (
    <Link
      href={`/orgs/new?match=${match.id}&kind=startup`}
      className="self-start rounded-xl border-2 border-beedero-black px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
    >
      Start a startup together
    </Link>
  );
}
