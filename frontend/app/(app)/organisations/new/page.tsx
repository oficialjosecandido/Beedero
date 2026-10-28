import Link from "next/link";

import { PageHeading } from "@/components/app-shell/ui";
import { CreateOrgForm } from "@/components/CreateOrgForm";

export const dynamic = "force-dynamic";

/**
 * Full-page create-org stepper. Not a modal — the sidebar "Manage
 * organisations" / "Create organisation" CTAs land here so each step has room.
 */
export default function NewOrganisationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeading
        eyebrow="New organisation"
        title="Create an organisation."
        actions={
          <Link
            href="/organisations"
            className="text-xs font-bold text-white/50 transition hover:text-white"
          >
            ← Back to organisations
          </Link>
        }
      />
      <p className="mb-6 max-w-xl text-sm leading-6 text-white/55">
        Only the name is required. Everything else is optional — skip what you don&apos;t have yet
        and finish the draft when you&apos;re ready.
      </p>
      <CreateOrgForm tone="dark" />
    </div>
  );
}
