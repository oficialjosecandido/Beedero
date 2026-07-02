import Link from "next/link";

import { CreateOrgForm } from "@/components/CreateOrgForm";
import { apiFetch } from "@/lib/api";

type Membership = { slug: string; name: string; role: string };

export default async function DashboardPage() {
  const orgs: Membership[] = await apiFetch("/orgs/");

  return (
    <div className="flex flex-1 flex-col items-center gap-10 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">Your organizations</h1>
        {orgs.length === 0 && (
          <p className="text-sm text-zinc-500">You&apos;re not a member of any organization yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {orgs.map((m) => (
            <Link
              key={m.slug}
              href={`/dashboard/${m.slug}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-zinc-500">{m.role}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-4 border-t border-zinc-200 pt-8">
        <h2 className="text-lg font-medium">Create new organization</h2>
        <CreateOrgForm />
      </div>
    </div>
  );
}
