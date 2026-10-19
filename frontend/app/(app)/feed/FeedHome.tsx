"use client";

import { useEffect, useState } from "react";

import { FeedComposer } from "./FeedComposer";
import { FeedList } from "./FeedList";
import type { FeedItem } from "./types";

type ChecklistItem = { key: string; done: boolean; hint: string; weight: number };

/**
 * Owns feed list state so a fresh publish appears immediately. `router.refresh()`
 * alone is not enough: FeedList used to keep the first `useState(initialItems)`
 * and ignore the RSC props that arrive after revalidation.
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
  const [postedToday, setPostedToday] = useState(composer.hasPostedToday);

  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  useEffect(() => {
    setPostedToday(composer.hasPostedToday);
  }, [composer.hasPostedToday]);

  function handlePublished(item: FeedItem) {
    setItems((prev) => [item, ...prev.filter((row) => !(row.type === item.type && row.id === item.id))]);
    setPostedToday(true);
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
