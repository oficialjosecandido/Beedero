export type FeedItem = {
  id: number;
  type: "org" | "person";
  org?: { slug: string; name: string; logo?: string | null };
  author?: { id: number; name: string };
  kind: string;
  value: {
    title?: string;
    body?: string;
    image?: string | null;
    occurred_at?: string;
  };
  reaction_count: number;
  comment_count: number;
  viewer_reaction: string | null;
};

export type Comment = {
  id: number;
  parent_id: number | null;
  author_name: string;
  body: string;
  created_at: string;
  can_delete: boolean;
};
