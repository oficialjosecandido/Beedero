import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { SECTION_LABELS } from "@/lib/types";

type FeedItem = {
  org: { slug: string; name: string };
  kind: string;
  key: string;
  value: {
    title?: string;
    body?: string;
    occurred_at?: string;
  };
};

export default async function FeedPage() {
  const items: FeedItem[] = await apiFetch("/feed/");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            Feed
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Updates from organizations you follow
          </h1>
        </header>

        <div className="grid gap-4">
          {items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500">
              No updates yet. Beedero is followed automatically until you follow other organizations.
            </div>
          )}
          {items.map((item) => (
            <article
              key={`${item.org.slug}-${item.key}`}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <Link
                  href={`/org/${item.org.slug}`}
                  className="font-semibold text-zinc-950 hover:text-emerald-700"
                >
                  {item.org.name}
                </Link>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {SECTION_LABELS[item.kind] ?? item.kind}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                {item.value.title ?? "Update"}
              </h2>
              {item.value.body && (
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.value.body}</p>
              )}
              {item.value.occurred_at && (
                <p className="mt-4 text-xs text-zinc-400">
                  {new Date(item.value.occurred_at).toLocaleDateString()}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
