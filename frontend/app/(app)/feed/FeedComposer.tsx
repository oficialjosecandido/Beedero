"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Link2, Send, Video, X } from "lucide-react";

import { createInvestorPostAction } from "@/app/(app)/dashboard/actions";
import { MentionTextarea } from "@/components/MentionTextarea";
import { useActionToast } from "@/lib/use-action-toast";

type ChecklistItem = { key: string; done: boolean; hint: string; weight: number };

type FeedComposerProps = {
  name: string;
  profilePicture?: string | null;
  profileComplete: boolean;
  hasPostedToday: boolean;
  completeness?: number;
  checklist?: ChecklistItem[];
};

const REQUIRED_KEYS = ["full_name", "headline", "country"];
const FIELD_LABELS: Record<string, string> = {
  full_name: "your name",
  headline: "a headline",
  country: "your country",
};

function formatMissingList(keys: string[]): string {
  const labels = keys.map((key) => FIELD_LABELS[key] ?? key);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function wordCount(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function titleFromBody(text: string) {
  const firstLine = text.trim().split(/\n/)[0] ?? "";
  const cleaned = firstLine.replace(/@\[[^\]]+\]/g, "").trim();
  if (!cleaned) return "Update";
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned;
}

function Avatar({
  name,
  profilePicture,
  size = "md",
}: {
  name: string;
  profilePicture?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-8" : "size-9";
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`grid ${dim} shrink-0 place-items-center rounded-full bg-[#68738a] text-xs font-black text-white`}
    >
      {initials || name.charAt(0).toUpperCase()}
    </span>
  );
}

export function FeedComposer({
  name,
  profilePicture,
  profileComplete,
  hasPostedToday,
  completeness = 0,
  checklist = [],
}: FeedComposerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const photoFilesRef = useRef<File[]>([]);
  const [error, formAction, pending] = useActionState(async (prev: string | null, formData: FormData) => {
    const file = photoFilesRef.current[0];
    if (file) formData.set("image", file);
    return createInvestorPostAction(prev, formData);
  }, null);
  const [body, setBody] = useState("");
  const [mediaMode, setMediaMode] = useState<"photos" | "video" | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoName, setVideoName] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const prevPending = useRef(false);
  const words = wordCount(body);
  const over = words > 100;
  useActionToast(error, pending, { successMessage: "Post published!" });

  useEffect(() => {
    photoFilesRef.current = photoFiles;
  }, [photoFiles]);

  function closeComposer() {
    setExpanded(false);
    setBody("");
    setMediaMode(null);
    setPhotoPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setPhotoFiles([]);
    setVideoName(null);
  }

  useEffect(() => {
    const justFinished = prevPending.current && !pending;
    prevPending.current = pending;
    if (justFinished && error === null) {
      setExpanded(false);
      setBody("");
      setMediaMode(null);
      setPhotoPreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      setPhotoFiles([]);
      setVideoName(null);
      router.refresh();
    }
  }, [pending, error, router]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeComposer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 5 - photoFiles.length);
    if (files.length === 0) return;
    const urls = files.map((file) => URL.createObjectURL(file));
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 5));
    setPhotoPreviews((prev) => [...prev, ...urls].slice(0, 5));
    setMediaMode("photos");
    setVideoName(null);
    event.target.value = "";
  }

  function handleVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setVideoName(file.name);
      setMediaMode("video");
      setPhotoPreviews((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      setPhotoFiles([]);
    }
    event.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotoPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  if (!profileComplete) {
    const missingRequired = checklist
      .filter((item) => REQUIRED_KEYS.includes(item.key) && !item.done)
      .map((item) => item.key);
    const headline =
      missingRequired.length > 0
        ? `Add ${formatMissingList(missingRequired)} before sharing updates.`
        : "Finish the steps below before sharing updates.";

    return (
      <div className="border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Complete your profile to post</p>
            <p className="mt-0.5 text-sm text-white/45">{headline}</p>
          </div>
        </div>
        {checklist.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-white/45">
              <span>Profile strength</span>
              <span>{completeness}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden bg-white/10">
              <div className="h-full bg-beedero-yellow transition-all" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        )}
        <Link
          href="/profile"
          className="mt-4 inline-flex bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (hasPostedToday) {
    return (
      <div className="border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div>
            <p className="text-sm font-semibold text-white">You have already posted today.</p>
            <p className="mt-1 text-sm text-white/45">
              Each profile can publish one update per day. Come back tomorrow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-4 border border-white/10 bg-white/[0.035] p-4 text-left text-base text-white/45 transition hover:border-beedero-yellow/60"
      >
        <Avatar name={name} profilePicture={profilePicture} />
        Share an update with the people who matter…
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}
        >
          <section className="w-full max-w-xl border border-white/15 bg-[#15181f] text-[#f4f4f1]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-3xl font-black tracking-[-0.045em]">Make it useful.</h2>
                <p className="mt-1 text-sm text-white/40">
                  Share an update with the people who matter.
                </p>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="text-white/45 hover:text-white"
                aria-label="Close composer"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <form action={formAction} className="p-6">
              <input type="hidden" name="kind" value="update" />
              <input type="hidden" name="title" value={titleFromBody(body)} />

              <div className="mb-3 flex items-center gap-2">
                <Avatar name={name} profilePicture={profilePicture} size="sm" />
                <span className="text-base font-bold">{name}</span>
                <span className="border border-white/20 bg-white/[0.08] px-2 py-0.5 text-[11px] font-black text-white/55">
                  UPDATE
                </span>
              </div>

              <MentionTextarea
                name="body"
                required
                autoFocus
                rows={5}
                onValueChange={setBody}
                placeholder="What is worth sharing today? Links go here too — keep it under 100 words."
                className={`h-32 w-full resize-none border bg-white/5 p-3 text-base text-white outline-none placeholder:text-white/30 ${
                  over ? "border-red-500/70" : "border-white/10 focus:border-beedero-yellow"
                }`}
              />
              <div
                className={`mt-1 text-right text-xs font-bold ${
                  over ? "text-red-400" : words > 80 ? "text-beedero-yellow" : "text-white/30"
                }`}
              >
                {words} / 100 words
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (mediaMode === "photos") {
                      setMediaMode(null);
                      setPhotoPreviews((prev) => {
                        prev.forEach((url) => URL.revokeObjectURL(url));
                        return [];
                      });
                      setPhotoFiles([]);
                    } else {
                      setMediaMode("photos");
                      setVideoName(null);
                      photoRef.current?.click();
                    }
                  }}
                  disabled={mediaMode === "video"}
                  className={`flex items-center gap-1.5 border px-3 py-2 text-sm font-bold transition disabled:opacity-30 ${
                    mediaMode === "photos"
                      ? "border-beedero-yellow text-beedero-yellow"
                      : "border-white/15 text-white/55 hover:border-white/30"
                  }`}
                >
                  <ImageIcon size={15} aria-hidden />
                  Photos{photoFiles.length > 0 ? ` (${photoFiles.length}/5)` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mediaMode === "video") {
                      setMediaMode(null);
                      setVideoName(null);
                    } else {
                      setMediaMode("video");
                      setPhotoPreviews((prev) => {
                        prev.forEach((url) => URL.revokeObjectURL(url));
                        return [];
                      });
                      setPhotoFiles([]);
                      videoRef.current?.click();
                    }
                  }}
                  disabled={mediaMode === "photos"}
                  className={`flex items-center gap-1.5 border px-3 py-2 text-sm font-bold transition disabled:opacity-30 ${
                    mediaMode === "video"
                      ? "border-beedero-yellow text-beedero-yellow"
                      : "border-white/15 text-white/55 hover:border-white/30"
                  }`}
                >
                  <Video size={15} aria-hidden />
                  Video
                </button>
                <span className="ml-auto flex items-center gap-1 text-xs text-white/25">
                  <Link2 size={12} aria-hidden /> Links go in the text
                </span>
              </div>

              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotos}
              />
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideo}
              />

              {photoPreviews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photoPreviews.map((src, i) => (
                    <div key={src} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="size-16 border border-white/10 object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-black text-white"
                        aria-label="Remove photo"
                      >
                        <X size={9} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {photoPreviews.length < 5 && (
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      className="grid size-16 place-items-center border border-dashed border-white/20 text-xs text-white/30 transition hover:border-beedero-yellow/40"
                    >
                      +
                    </button>
                  )}
                </div>
              )}

              {videoName && (
                <div className="mt-3 flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                  <Video size={13} className="text-beedero-yellow" aria-hidden />
                  <span className="flex-1 truncate">{videoName}</span>
                  <span className="text-[10px] text-white/35">Preview only — video upload soon</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoName(null);
                      setMediaMode(null);
                    }}
                    className="text-white/35 hover:text-white"
                    aria-label="Remove video"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={pending || !body.trim() || over}
                  className="flex items-center gap-2 bg-beedero-yellow px-5 py-2.5 text-sm font-black text-beedero-black transition disabled:opacity-40"
                >
                  <Send size={13} aria-hidden />
                  {pending ? "Publishing…" : "Publish"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
