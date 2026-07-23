import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-center">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex rounded-full bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
