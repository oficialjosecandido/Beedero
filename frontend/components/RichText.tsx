import Link from "next/link";
import type { ReactNode } from "react";

import { stripTrailingPunctuation, type ResolvedMention } from "@/lib/richtext";

/** URL auto-linkification (spec §A1) + `@[user:handle]`/`@[org:slug]` marker
 * rendering (spec §B) for plain-text post/comment bodies. Body text is never
 * HTML — this only ever builds React nodes, so there is no
 * dangerouslySetInnerHTML anywhere in this path. */
export function RichText({
  body,
  mentions = [],
  className,
}: {
  body?: string | null;
  mentions?: ResolvedMention[];
  className?: string;
}) {
  if (!body) return null;

  const tokenRe = /@\[(user|org):([a-zA-Z0-9_-]+)\]|(https?:\/\/[^\s<>"']+)/g;
  const mentionByMarker = new Map(mentions.map((mention) => [mention.marker, mention]));
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(body)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(body.slice(lastIndex, match.index));
    }
    const [full, mentionKind, mentionId, rawUrl] = match;

    if (rawUrl) {
      const url = stripTrailingPunctuation(rawUrl);
      nodes.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-words text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-2"
        >
          {url}
        </a>
      );
      lastIndex = match.index + url.length;
      continue;
    }

    const marker = `@[${mentionKind}:${mentionId}]`;
    const resolved = mentionByMarker.get(marker);
    if (resolved) {
      const href = resolved.type === "org" ? `/org/${resolved.slug}` : `/p/${resolved.handle}`;
      nodes.push(
        <Link key={key++} href={href} className="font-semibold text-beedero-black hover:underline">
          @{resolved.name}
        </Link>
      );
    } else {
      // Marker didn't resolve (handle/slug freed or deleted since posting) —
      // fall back to plain text rather than a dead link.
      nodes.push(`@${mentionId}`);
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < body.length) {
    nodes.push(body.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
}
