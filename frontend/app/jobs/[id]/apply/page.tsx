import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ApiError, apiFetch, publicFetch, safeFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { noIndexMetadata } from "@/lib/site-metadata";
import { refFor, registerUrl, safeRef } from "@/lib/signup-ref";
import type { PublicJob } from "@/lib/types";

import { ApplyForm } from "./ApplyForm";

/**
 * Applying — the destination §3.2 sends people to, signed in or not.
 *
 * Never indexed: it is a form behind a session, and the role's own page is the
 * one Google should hold. The redirect for a visitor with no session is exactly
 * the URL §3.2 specifies, so a signed-out person who lands here from a shared
 * link ends up in the same place as one who pressed the button on the job page.
 */

export const metadata: Metadata = { title: "Apply", ...noIndexMetadata };

type MeProfile = { full_name?: string; headline?: string; city?: string };

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string; sent?: string }>;
}) {
  const [{ id }, { ref, sent }] = await Promise.all([params, searchParams]);

  if (!(await getAccessToken())) {
    redirect(registerUrl(safeRef(ref) || refFor("job", id), `/jobs/${id}/apply`));
  }

  let job: PublicJob;
  try {
    job = await publicFetch<PublicJob>(`/public/jobs/${id}/`);
  } catch (err) {
    // Closed or expired between opening the page and pressing apply. The role
    // is gone, so this form has nothing to submit to.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Which of the three §3.5 fields are still blank. A failure here must not
  // cost someone their application, so an unreachable profile endpoint means
  // "ask for all three" — the API fills blanks only, and ignores the rest.
  const profile = await safeFetch(apiFetch<MeProfile>("/investors/me/"), {} as MeProfile);
  const missing = {
    full_name: !profile.full_name?.trim(),
    headline: !profile.headline?.trim(),
    city: !profile.city?.trim(),
  };

  if (sent === "1") {
    return (
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-2xl flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950">
            Application sent
          </h1>
          <p className="text-sm leading-6 text-zinc-700">
            {job.org.name} has your application for {job.title}. If they want to talk, the
            conversation opens in your messages — you&apos;ll get a notification.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/profile"
              className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black transition hover:opacity-90"
            >
              Finish your profile
            </Link>
            <Link
              href="/jobs"
              className="rounded-xl border-2 border-beedero-border px-5 py-2.5 text-sm font-semibold text-beedero-black transition hover:bg-beedero-yellow/20"
            >
              See other roles
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
            <Link href={`/jobs/${job.id}`} className="font-semibold underline hover:text-beedero-black">
              {job.title}
            </Link>{" "}
            / Apply
          </nav>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            Apply to {job.org.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {job.title} · {job.engagement_label}
            {job.location_city ? ` · ${job.location_city}` : ` · ${job.location_label}`}
          </p>
        </div>

        <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm sm:p-8">
          <ApplyForm
            jobId={job.id}
            jobTitle={job.title}
            orgName={job.org.name}
            missing={missing}
          />
        </div>
      </div>
    </main>
  );
}
