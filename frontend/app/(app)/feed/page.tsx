import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { SECTION_LABELS } from "@/lib/types";

type FeedItem = {
  type: "org" | "person";
  org?: { slug: string; name: string; logo?: string | null };
  author?: { id: number; name: string };
  kind: string;
  key: string;
  value: {
    title?: string;
    body?: string;
    image?: string | null;
    occurred_at?: string;
  };
};

export default async function FeedPage() {
  const items: FeedItem[] = await apiFetch("/feed/");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
            Feed
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Updates from people and organizations you follow
          </h1>
        </header>

        <div className="grid gap-4">
          {items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-beedero-black/20 bg-beedero-white p-8 text-sm text-zinc-500">
              No updates yet. Beedero is followed automatically until you follow other people and
              organizations.
            </div>
          )}
          {items.map((item) => (
            <article
              key={`${item.type}-${item.key}`}
              className="rounded-3xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                {item.type === "org" && item.org ? (
                  <Link
                    href={`/org/${item.org.slug}`}
                    className="flex items-center gap-2 font-semibold text-zinc-950 hover:underline hover:decoration-beedero-yellow hover:decoration-2 hover:underline-offset-4"
                  >
                    {item.org.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.org.logo} alt="" className="size-8 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500">
                        {item.org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {item.org.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-zinc-950">{item.author?.name ?? "Someone"}</span>
                )}
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
              {item.value.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.value.image}
                  alt=""
                  className="mt-3 max-h-96 w-full rounded-2xl object-cover"
                />
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
