import Link from "next/link";
import { notFound } from "next/navigation";

import { CREDIBILITY_LEVEL_LABELS } from "@/lib/credibility";
import { formatDate } from "@/lib/format";
import { ApiError, publicFetch } from "@/lib/api";
import { pageMetadata } from "@/lib/site-metadata";

type VerifyData = {
  org: {
    slug: string;
    name: string;
    one_liner: string;
    logo: string | null;
  };
  badge: {
    level: number;
    visual_status: string;
    valid_until: string | null;
    days_until_expiry: number | null;
    layers: { level: number; label: string; verified: boolean }[];
    as_of: string;
  };
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = (await publicFetch(`/public/verify/${slug}/`)) as VerifyData;
    return pageMetadata({
      title: `${data.org.name} — Beedero verification`,
      description: `Verify ${data.org.name}'s credibility status on Beedero.`,
      path: `/verify/${slug}`,
    });
  } catch {
    return { title: "Verification" };
  }
}

const STATUS_BADGE: Record<string, string> = {
  verified: "bg-beedero-yellow text-beedero-black",
  expiring: "bg-amber-100 text-amber-900",
  expired: "bg-zinc-200 text-zinc-600",
  unverified: "bg-zinc-100 text-zinc-500",
};

export default async function VerifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let data: VerifyData;
  try {
    data = await publicFetch<VerifyData>(`/public/verify/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { org, badge } = data;

  return (
    <main className="flex flex-1 justify-center px-4 py-12 lg:px-6 lg:py-16">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt="" className="size-14 rounded-2xl object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-2xl bg-beedero-yellow/30 text-xl font-extrabold text-beedero-black">
                {org.name.charAt(0)}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-zinc-900">{org.name}</h1>
              {org.one_liner && <p className="mt-1 text-sm text-zinc-600">{org.one_liner}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_BADGE[badge.visual_status] ?? STATUS_BADGE.unverified}`}>
              {badge.visual_status.replace("_", " ")}
            </span>
            {badge.level > 0 && (
              <span className="rounded-full bg-beedero-black px-3 py-1 text-xs font-bold text-beedero-yellow">
                Level {badge.level} · {CREDIBILITY_LEVEL_LABELS[badge.level]}
              </span>
            )}
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/badge/${slug}.svg`}
            alt="Beedero verification badge"
            className="mt-6 h-14 w-auto"
          />

          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Verified layers</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {badge.layers.map((layer) => (
                <li key={layer.level} className="flex items-center gap-2 text-sm">
                  <span>{layer.verified ? "✅" : "⬜"}</span>
                  <span className={layer.verified ? "font-semibold text-zinc-900" : "text-zinc-400"}>
                    Level {layer.level} — {layer.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-xs text-zinc-500">
            Status as of {formatDate(badge.as_of)}
            {badge.valid_until && ` · earliest certificate valid until ${formatDate(badge.valid_until)}`}
          </p>

          <div className="mt-8 rounded-2xl border border-dashed border-beedero-border bg-beedero-yellow/10 p-4">
            <p className="text-sm font-semibold text-beedero-black">What is Beedero verification?</p>
            <p className="mt-1 text-sm text-zinc-600">
              Beedero verifies startup identity, compliance, and traction through a structured credibility ladder.
              This page shows only public verification status — never private financials.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex text-sm font-bold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
            >
              Learn about Beedero
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
