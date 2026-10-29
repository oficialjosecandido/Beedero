import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsletterEditor } from "@/components/nexus/NewsletterEditor";
import { PageHeader } from "@/components/nexus/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { NewsletterSendRow, Segment } from "@/lib/nexus";

export default async function NewsletterSendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let send: NewsletterSendRow;
  let segments: Segment[];
  try {
    [send, { segments }] = await Promise.all([
      apiFetch<NewsletterSendRow>(`/nexus/newsletter/${id}/`),
      apiFetch<{ segments: Segment[] }>("/nexus/newsletter/"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/beedero-nexus/newsletter" className="text-xs font-bold text-white/45 hover:text-white">
        ← Newsletter
      </Link>
      <PageHeader
        eyebrow={send.status === "draft" ? "Draft" : send.status === "sending" ? "Sending" : "Sent"}
        title={send.subject || "New email"}
        description="Write, check the preview, send yourself a test, then send."
      />
      <NewsletterEditor key={send.id} initial={send} segments={segments} />
    </div>
  );
}
