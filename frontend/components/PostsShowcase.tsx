"use client";

import { useState } from "react";

import { formatDate } from "@/lib/format";
import { RichText } from "@/components/RichText";
import type { ResolvedMention } from "@/lib/richtext";

type Post = {
  id: number;
  kind: string;
  title: string;
  body: string;
  occurred_at: string;
  mentions?: ResolvedMention[];
};

const VISIBLE_COUNT = 3;

export function PostsShowcase({ posts }: { posts: Post[] }) {
  const [expanded, setExpanded] = useState(false);
  if (posts.length === 0) return null;

  const visible = expanded ? posts : posts.slice(0, VISIBLE_COUNT);
  const hiddenCount = posts.length - VISIBLE_COUNT;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Activity</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {visible.map((post) => (
          <li key={post.id} className="rounded-xl border border-beedero-border/70 px-4 py-3">
            <p className="font-semibold text-zinc-900">{post.title}</p>
            {post.body && (
              <p className="mt-1 text-sm text-zinc-600">
                <RichText body={post.body} mentions={post.mentions} />
              </p>
            )}
            <p className="mt-1 text-xs text-subtle">{formatDate(post.occurred_at)}</p>
          </li>
        ))}
      </ul>
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-semibold text-beedero-black underline underline-offset-2"
        >
          Ver mais ({hiddenCount})
        </button>
      )}
    </section>
  );
}
