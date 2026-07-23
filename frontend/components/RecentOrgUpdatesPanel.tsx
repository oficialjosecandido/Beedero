import Link from "next/link";

import { AppColumnSection } from "@/components/AppColumnSection";
import { formatRelativeTime } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/types";

import type { FeedItem } from "@/app/(app)/feed/types";

export type RecentOrgUpdateItem = {
  id: number;
  title: string;
  kind: string;
  created_at: string;
  org: { slug: string; name: string; logo?: string | null };
};

/** Use dedicated API when available; otherwise derive from feed org posts. */
export function resolveOrgNewsUpdates(
  apiItems: RecentOrgUpdateItem[],
  feedItems?: FeedItem[]
): RecentOrgUpdateItem[] {
  if (apiItems.length > 0) return apiItems.slice(0, 5);
  if (!feedItems) return [];

  return feedItems
    .filter((item) => item.type === "org" && item.org)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.value.title ?? "Update",
      kind: item.kind,
      created_at: item.created_at ?? item.value.occurred_at ?? new Date().toISOString(),
      org: {
        slug: item.org!.slug,
        name: item.org!.name,
        logo: item.org!.logo,
      },
    }));
}

export function RecentOrgUpdatesPanel({ items }: { items: RecentOrgUpdateItem[] }) {
  return (
    <AppColumnSection label="News">
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-6 text-zinc-500 sm:px-5">
          No organization updates yet. When startups publish news, the latest will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {items.map((item) => {
            const kindLabel = SECTION_LABELS[item.kind] ?? item.kind;
            return (
              <li key={item.id}>
                <Link
                  href={`/org/${item.org.slug}`}
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5"
                >
                  {item.org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.org.logo}
                      alt=""
                      className="mt-0.5 size-9 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-xs font-semibold text-zinc-600">
                      {item.org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.org.name} · {kindLabel} · {formatRelativeTime(item.created_at)}
                    </p>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppColumnSection>
  );
}
