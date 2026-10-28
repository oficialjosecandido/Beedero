import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyPanel, PageHeading, btnPrimary, btnGhost } from "@/components/app-shell/ui";
import { ApiError, apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

type Membership = {
  slug: string;
  name: string;
  role: string;
  logo?: string | null;
};

export default async function OrganisationsPage() {
  let orgs: Membership[];
  try {
    orgs = await apiFetch<Membership[]>("/orgs/");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login?next=/organisations");
    throw err;
  }

  return (
    <>
      <PageHeading
        eyebrow="Your organisations"
        title="Organisations."
        actions={
          <Link href="/orgs/new" className={btnPrimary}>
            <Plus size={14} aria-hidden />
            Create organisation
          </Link>
        }
      />

      {orgs.length === 0 ? (
        <EmptyPanel>
          You&apos;re not on any organisation yet.{" "}
          <Link href="/orgs/new" className="font-bold text-beedero-yellow hover:underline">
            Create one
          </Link>{" "}
          to open a workspace.
        </EmptyPanel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {orgs.map((org) => (
            <li key={org.slug}>
              <Link
                href={`/dashboard/${org.slug}`}
                className="flex items-center gap-4 border border-white/10 bg-white/[0.025] p-4 transition hover:border-beedero-yellow/50"
              >
                {org.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={org.logo}
                    alt=""
                    className="size-12 shrink-0 object-cover"
                  />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center bg-white/10 text-beedero-yellow">
                    <Building2 size={20} aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-base">{org.name}</b>
                  <small className="mt-0.5 block text-xs uppercase tracking-[0.1em] text-white/45">
                    {org.role}
                  </small>
                </span>
                <span className={`${btnGhost} shrink-0`}>Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
