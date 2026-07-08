export type FeedItem = {
  id: string;
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
