"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { nexusCall } from "@/app/beedero-nexus/actions";
import type { NewsletterSendRow, Segment, SendProgress } from "@/lib/nexus";

import { Badge, nexusButtonClass, nexusInputClass, nexusPrimaryButtonClass } from "./ui";

const HELP = "Blank line = new paragraph · ## Heading · - list item · **bold** · [text](https://link)";

export function NewDraftButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={nexusPrimaryButtonClass}
      onClick={() =>
        startTransition(async () => {
          const result = await nexusCall<NewsletterSendRow>("/nexus/newsletter/", "POST", {
            kind: "newsletter",
            segment: "subscribers",
          });
          if (!result.ok || !result.data) {
            toast.error(result.error);
            return;
          }
          router.push(`/beedero-nexus/newsletter/${result.data.id}`);
        })
      }
    >
      {pending ? "…" : "New email"}
    </button>
  );
}

function ProgressBar({ progress }: { progress: SendProgress }) {
  const done = progress.sent + progress.failed;
  const pct = progress.total ? Math.round((done / progress.total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60">
        <span>
          {progress.sent} sent{progress.failed ? ` · ${progress.failed} failed` : ""}
          {progress.pending ? ` · ${progress.pending} to go` : ""}
          {progress.unsubscribed ? ` · ${progress.unsubscribed} unsubscribed` : ""}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 bg-white/10">
        <div className="h-full bg-beedero-yellow transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NewsletterEditor({ initial, segments }: { initial: NewsletterSendRow; segments: Segment[] }) {
  const router = useRouter();
  const [send, setSend] = useState(initial);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body ?? "");
  const [kind, setKind] = useState(initial.kind);
  const [segment, setSegment] = useState(initial.segment);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);

  const editable = send.status === "draft";
  const dirty = subject !== send.subject || body !== (send.body ?? "") || kind !== send.kind || segment !== send.segment;
  const options = segments.filter((item) => item.kind === kind);

  async function save(): Promise<NewsletterSendRow | null> {
    const result = await nexusCall<NewsletterSendRow>(`/nexus/newsletter/${send.id}/`, "PATCH", {
      subject,
      body,
      kind,
      segment,
    });
    if (!result.ok || !result.data) {
      setError(result.error);
      return null;
    }
    setSend(result.data);
    setSegment(result.data.segment);
    return result.data;
  }

  // While a send is going out, keep asking the server for the next batch —
  // started once per send, stopped only when the page goes away.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sendingNow = send.status === "sending";
  useEffect(() => {
    if (!sendingNow || sending.current) return;
    sending.current = true;
    const id = send.id;
    void (async () => {
      let status: string = "sending";
      while (mounted.current && status === "sending") {
        const result = await nexusCall<NewsletterSendRow>(`/nexus/newsletter/${id}/process/`, "POST");
        if (!result.ok || !result.data) {
          setError(`${result.error} Sending paused — reload the page to carry on.`);
          break;
        }
        const data = result.data;
        status = data.status;
        setSend((previous) => ({ ...previous, ...data }));
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      sending.current = false;
      if (status === "sent") {
        toast.success("Sent.");
        router.refresh();
      }
    })();
  }, [sendingNow, send.id, router]);

  function onSave() {
    setError(null);
    startTransition(async () => {
      if (await save()) toast.success("Draft saved.");
    });
  }

  function onTest() {
    setError(null);
    startTransition(async () => {
      if (dirty && !(await save())) return;
      const result = await nexusCall<{ sent_to: string }>(`/nexus/newsletter/${send.id}/test/`, "POST");
      if (!result.ok) setError(result.error);
      else toast.success(`Test sent to ${result.data?.sent_to}.`);
    });
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      if (dirty && !(await save())) return;
      setConfirming(true);
    });
  }

  function onSend() {
    setError(null);
    startTransition(async () => {
      const result = await nexusCall<NewsletterSendRow>(`/nexus/newsletter/${send.id}/send/`, "POST", {
        expected_count: send.audience_count,
      });
      setConfirming(false);
      if (!result.ok || !result.data) {
        setError(result.error);
        const fresh = await save();
        if (fresh) setSend(fresh);
        return;
      }
      setSend(result.data);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await nexusCall(`/nexus/newsletter/${send.id}/`, "DELETE");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/beedero-nexus/newsletter");
    });
  }

  const chosen = segments.find((item) => item.key === segment);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 border border-app-border bg-app-surface p-4">
        {!editable && send.progress && (
          <div className="border border-app-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Badge tone={send.status === "sent" ? "good" : "warn"}>{send.status}</Badge>
              {send.recipients} recipients · {send.segment_label}
            </p>
            <ProgressBar progress={send.progress} />
            {send.status === "sending" && (
              <p className="mt-2 text-[11px] text-white/45">Keep this page open while it sends. Closed early? The daily job finishes it.</p>
            )}
          </div>
        )}

        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Kind</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    "newsletter",
                    "Newsletter",
                    "Marketing. Only people who opted in, plus contacts. Has an unsubscribe link.",
                  ],
                  [
                    "announcement",
                    "Service announcement",
                    "Service changes (terms, prices, security). Choose All users or All organisations below. Use sparingly — no opt-in needed.",
                  ],
                ] as const
              ).map(([key, label, hint]) => (
                <label
                  key={key}
                  className={`cursor-pointer border p-3 text-sm ${kind === key ? "border-beedero-yellow bg-beedero-yellow/10" : "border-app-border"}`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <input
                      type="radio"
                      name="kind"
                      checked={kind === key}
                      onChange={() => {
                        setKind(key);
                        setSegment(key === "newsletter" ? "subscribers" : "all_accounts");
                      }}
                      className="accent-beedero-yellow"
                    />
                    {label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-white/45">{hint}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="text-xs font-bold text-white/60">
            Who
            <select value={segment} onChange={(event) => setSegment(event.target.value)} className={`${nexusInputClass} mt-1.5`}>
              <option value="">Choose…</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} — {option.count} {option.count === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
            {chosen && <span className="mt-1 block text-[11px] font-normal text-white/40">{chosen.description}</span>}
          </label>

          <label className="text-xs font-bold text-white/60">
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={255}
              placeholder="What's new at Beedero — November"
              className={`${nexusInputClass} mt-1.5`}
            />
          </label>

          <label className="text-xs font-bold text-white/60">
            Message
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={16}
              placeholder={"Hello,\n\nThis month on Beedero…\n\n## What's new\n\n- …\n- …"}
              className={`${nexusInputClass} mt-1.5 font-mono text-[13px] leading-6`}
            />
            <span className="mt-1 block text-[11px] font-normal text-white/40">{HELP}</span>
          </label>
        </fieldset>

        {error && <p className="text-xs font-bold text-[#ff8d82]">{error}</p>}

        {editable && (
          <div className="flex flex-wrap items-center gap-2 border-t border-app-border pt-4">
            <button type="button" onClick={onSave} disabled={pending || !dirty} className={nexusButtonClass}>
              {dirty ? "Save draft" : "Saved"}
            </button>
            <button type="button" onClick={onTest} disabled={pending} className={nexusButtonClass}>
              Send me a test
            </button>
            <button type="button" onClick={onConfirm} disabled={pending || !segment} className={nexusPrimaryButtonClass}>
              Send…
            </button>
            <button type="button" onClick={onDelete} disabled={pending} className="ml-auto text-xs font-bold text-white/40 hover:text-[#ff8d82]">
              Delete draft
            </button>
          </div>
        )}

        {confirming && (
          <div className="border border-beedero-yellow bg-beedero-yellow/10 p-4">
            <p className="text-sm font-bold text-white">
              Send “{send.subject}” to {send.audience_count} {send.audience_count === 1 ? "person" : "people"} now?
            </p>
            <p className="mt-1 text-xs text-white/55">
              {send.kind === "announcement"
                ? "A service announcement reaches every account, opted in or not. Make sure this is a change to the service."
                : "Only people who opted in, and newsletter contacts. Each email has an unsubscribe link."}{" "}
              It can&apos;t be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onSend} disabled={pending} className={nexusPrimaryButtonClass}>
                {pending ? "…" : `Send to ${send.audience_count}`}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={nexusButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border border-app-border bg-app-surface">
        <p className="flex items-center justify-between border-b border-app-border px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white/60">
          Preview
          {editable && dirty && <span className="normal-case tracking-normal text-beedero-yellow">Save to update</span>}
        </p>
        <iframe
          title="Email preview"
          srcDoc={send.preview_html}
          sandbox=""
          className="h-[760px] w-full bg-[#e8e8e4]"
        />
      </div>
    </div>
  );
}
