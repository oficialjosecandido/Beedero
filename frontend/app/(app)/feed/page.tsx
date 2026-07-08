import { apiFetch } from "@/lib/api";

import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

export default async function FeedPage() {
  const { items, next_cursor }: { items: FeedItem[]; next_cursor: string | null } =
    await apiFetch("/feed/");

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

        <FeedList initialItems={items} initialCursor={next_cursor} />
      </div>
    </main>
  );
}
