"use client";

import { useState } from "react";

import { FeedComposer } from "./FeedComposer";
import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

type ChecklistItem = { key: string; done: boolean; hint: string; weight: number };

/**
 * Owns feed list state so a fresh publish appears immediately. `router.refresh()`
 * alone is not enough: FeedList used to keep the first `useState(initialItems)`
 * and ignore the RSC props that arrive after revalidation.
 *
 * When RSC props change, adjust state during render (same pattern as InsightsTabs)
 * rather than syncing in an effect — avoids react-hooks/set-state-in-effect.
 */
export function FeedHome({
  initialItems,
  initialCursor,
  composer,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
  composer: {
    name: string;
    profilePicture?: string | null;
    profileComplete: boolean;
    hasPostedToday: boolean;
    completeness?: number;
    checklist?: ChecklistItem[];
  };
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  const [prevInitialCursor, setPrevInitialCursor] = useState(initialCursor);
  const [postedOverride, setPostedOverride] = useState(false);

  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }
  if (initialCursor !== prevInitialCursor) {
    setPrevInitialCursor(initialCursor);
    setCursor(initialCursor);
  }

  const postedToday = postedOverride || composer.hasPostedToday;

  function handlePublished(item: FeedItem) {
    setItems((prev) => [item, ...prev.filter((row) => !(row.type === item.type && row.id === item.id))]);
    setPostedOverride(true);
  }

  return (
    <>
      <div className="mt-7">
        <FeedComposer
          {...composer}
          hasPostedToday={postedToday}
          onPublished={handlePublished}
        />
      </div>
      <div className="mt-5">
        <FeedList items={items} setItems={setItems} cursor={cursor} setCursor={setCursor} />
      </div>
    </>
  );
}
