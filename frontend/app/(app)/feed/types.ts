export type FeedItem = {
  id: number;
  type: "org" | "person";
  org?: { slug: string; name: string; logo?: string | null };
  author?: { id: number; name: string; handle?: string | null; headline?: string; profile_picture?: string | null };
  kind: string;
  value: {
    title?: string;
    body?: string;
    image?: string | null;
    occurred_at?: string;
    ends_at?: string | null;
    payload?: Record<string, unknown>;
  };
  reaction_count: number;
  reaction_counts?: { like: number; insight: number; congrats: number };
  comment_count: number;
  viewer_reaction: string | null;
  viewer_has_commented?: boolean;
  viewer_participation?: "going" | null;
  is_suggested?: boolean;
  created_at?: string;
};

export type Comment = {
  id: number;
  author_name: string;
  body: string;
  created_at: string;
};

export type ConversationSummary = {
  id: number;
  other_participant: { id: number; name: string; profile_picture?: string | null };
  last_message: { body: string; is_mine: boolean } | null;
  last_message_at: string | null;
  unread_count: number;
};

export type MessageItem = {
  id: number;
  body: string;
  created_at: string;
  is_mine: boolean;
};
