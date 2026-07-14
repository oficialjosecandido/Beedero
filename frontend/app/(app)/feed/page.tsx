import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";

import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

export default async function FeedPage() {
  let items: FeedItem[];
  let next_cursor: string | null;
  try {
    ({ items, next_cursor } = await apiFetch("/feed/"));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

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
