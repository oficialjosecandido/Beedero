import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 text-center shadow-sm">
        <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
          Invite
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Join this organization</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You&apos;ve been invited to join an organization&apos;s team on Beedero.
        </p>
        <AcceptInviteForm token={token} />
      </div>
    </main>
  );
}
