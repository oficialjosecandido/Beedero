"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { listJobApplicationsAction, setApplicationStatusAction } from "@/app/(app)/dashboard/job-actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatDate } from "@/lib/format";
import { formatAtHandle } from "@/lib/handles";
import type { ApplicationSummary } from "@/lib/types";

const STATUS_ACTIONS = [
  { value: "viewed", label: "Mark viewed" },
  { value: "interested", label: "Mark interested" },
  { value: "declined", label: "Decline" },
  { value: "hired", label: "Mark hired" },
];

function ApplicantAvatar({
  name,
  profilePicture,
}: {
  name: string;
  profilePicture?: string | null;
}) {
  if (profilePicture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profilePicture} alt="" className="size-9 shrink-0 rounded-full object-cover ring-1 ring-beedero-border" />;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 ring-1 ring-beedero-border">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ApplicationRow({
  slug,
  application,
  onStatusChange,
}: {
  slug: string;
  application: ApplicationSummary;
  onStatusChange: (id: number, status: ApplicationSummary["status"]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { applicant } = application;
  const profileHref = applicant.handle ? `/p/${applicant.handle}` : null;

  function handleStatus(status: string) {
    startTransition(async () => {
      const result = await setApplicationStatusAction(slug, application.id, status);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onStatusChange(application.id, status as ApplicationSummary["status"]);
    });
  }

  const identity = (
    <>
      <ApplicantAvatar name={applicant.name} profilePicture={applicant.profile_picture} />
      <div className="min-w-0">
        <p className="font-medium text-zinc-950">{applicant.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500">
          {applicant.handle && <span>{formatAtHandle(applicant.handle)}</span>}
          {applicant.headline && <span>{applicant.headline}</span>}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-beedero-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {profileHref ? (
          <Link href={profileHref} className="flex min-w-0 items-center gap-2.5 hover:opacity-90">
            {identity}
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">{identity}</div>
        )}
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          {application.status}
        </span>
      </div>
      {application.note && <p className="text-xs text-zinc-600">{application.note}</p>}
      {application.external_link && (
        <a
          href={application.external_link}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-beedero-black underline"
        >
          External link
        </a>
      )}
      {profileHref && (
        <Link href={profileHref} className="text-xs font-semibold text-beedero-black underline">
          View public profile
        </Link>
      )}
      <p className="text-xs text-zinc-400">Applied {formatDate(application.created_at)}</p>

      {application.status === "interested" ? (
        <Link href="/messages" className="text-xs font-semibold text-beedero-black underline">
          Message sent — continue in Messages
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          {STATUS_ACTIONS.filter((option) => option.value !== application.status).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isPending}
              onClick={() => handleStatus(option.value)}
              className="rounded-lg border border-beedero-border px-2.5 py-1 text-xs font-medium hover:bg-beedero-yellow/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ApplicationsList({ slug, jobId }: { slug: string; jobId: number }) {
  const [items, setItems] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listJobApplicationsAction(slug, jobId)
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load applications.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, jobId]);

  function handleStatusChange(id: number, status: ApplicationSummary["status"]) {
    setItems((prev) => prev?.map((item) => (item.id === id ? { ...item, status } : item)) ?? prev);
  }

  if (error) return <p className="border-t border-beedero-border pt-3 text-sm text-danger">{error}</p>;
  if (items === null) {
    return (
      <div className="border-t border-beedero-border pt-3">
        <LoadingSpinner className="size-5" label="Loading applications" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="border-t border-beedero-border pt-3 text-sm text-zinc-500">No applications yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-beedero-border pt-3">
      {items.map((application) => (
        <ApplicationRow
          key={application.id}
          slug={slug}
          application={application}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}
