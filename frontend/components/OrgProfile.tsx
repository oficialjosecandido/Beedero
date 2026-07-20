import { CredibilityBadge } from "@/components/CredibilityBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatAtHandle } from "@/lib/handles";
import { OrgProfile as OrgProfileData, SECTION_LABELS } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  summary: "About",
  mission: "Mission",
  vision: "Vision",
  values: "Values",
};

function FieldValue({
  fieldKey,
  value,
  sectionKind,
}: {
  fieldKey: string;
  value: unknown;
  sectionKind?: string;
}) {
  if (value && typeof value === "object" && "title" in (value as Record<string, unknown>)) {
    const post = value as {
      title: string;
      body?: string;
      occurred_at?: string;
      ends_at?: string | null;
      image?: string;
    };
    return (
      <div>
        <p className="font-medium">{post.title}</p>
        {post.body && <p className="text-sm text-zinc-600">{post.body}</p>}
        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image} alt="" className="mt-2 max-h-72 w-full rounded-xl object-cover" />
        )}
        {sectionKind === "events" && post.occurred_at && post.ends_at ? (
          <p className="text-xs text-zinc-400">
            {formatDateTime(post.occurred_at)} – {formatDateTime(post.ends_at)}
          </p>
        ) : (
          post.occurred_at && (
            <p className="text-xs text-zinc-400">{formatDate(post.occurred_at)}</p>
          )
        )}
      </div>
    );
  }
  if (value && typeof value === "object" && "name" in (value as Record<string, unknown>)) {
    const member = value as { name?: string; role?: string; linkedin?: string; joined_at?: string };
    return (
      <div className="rounded-xl border border-beedero-border p-3">
        <p className="font-medium">{member.name}</p>
        <p className="text-sm text-zinc-600">
          {member.role}
          {member.joined_at ? ` · joined ${formatDate(member.joined_at)}` : ""}
        </p>
        {member.linkedin && (
          <a
            href={member.linkedin}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            LinkedIn profile
          </a>
        )}
      </div>
    );
  }
  if (FIELD_LABELS[fieldKey]) {
    return (
      <div>
        <p className="text-sm font-semibold text-zinc-900">{FIELD_LABELS[fieldKey]}</p>
        <p className="text-sm leading-6 text-zinc-700">{String(value)}</p>
      </div>
    );
  }
  return <p className="text-sm text-zinc-700">{String(value)}</p>;
}

/**
 * §5.1: the frontend never decides visibility — it only renders what
 * `sections` contains. Absent sections simply don't appear.
 */
export function OrgProfile({ data }: { data: OrgProfileData }) {
  const sectionEntries = Object.entries(data.sections);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {data.org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.org.logo} alt="" className="size-12 rounded-xl border border-beedero-border object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-500">
              {data.org.name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="text-3xl font-extrabold">{data.org.name}</h1>
          <CredibilityBadge level={data.org.credibility_level ?? 0} />
          {data.org.is_verified && (
            <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-xs font-bold text-beedero-black">
              Verified
            </span>
          )}
          {data.org.is_fundraising && (
            <span className="rounded-full bg-beedero-black px-2 py-0.5 text-xs font-bold text-beedero-yellow">
              Fundraising
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-zinc-600">{formatAtHandle(data.org.slug)}</p>
        {data.org.freshness && (
          <p className="text-sm font-medium text-emerald-800">{data.org.freshness}</p>
        )}
      </header>

      {data.upcoming_events && data.upcoming_events.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-yellow/10 p-5">
          <h2 className="text-lg font-extrabold">Upcoming events</h2>
          <div className="flex flex-col gap-3">
            {data.upcoming_events.map((event) => (
              <div key={event.id} className="rounded-xl border border-beedero-border bg-white p-4">
                <p className="font-semibold text-beedero-black">{event.value.title}</p>
                {event.value.occurred_at && event.value.ends_at && (
                  <p className="mt-1 text-sm text-zinc-600">
                    {formatDateTime(event.value.occurred_at)} – {formatDateTime(event.value.ends_at)}
                  </p>
                )}
                {event.value.payload?.format && (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {event.value.payload.format.replace("_", " ")}
                  </p>
                )}
                {event.value.payload?.registration_url && (
                  <a
                    href={event.value.payload.registration_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
                  >
                    Register
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {sectionEntries.length === 0 && (
        <p className="text-sm text-zinc-500">Nothing visible to you on this page.</p>
      )}

      {sectionEntries.map(([kind, fields]) => (
        <section key={kind} className="flex flex-col gap-3 border-t border-beedero-border pt-4">
          <h2 className="text-lg font-extrabold">{SECTION_LABELS[kind] ?? kind}</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(fields).map(([key, value]) => (
              <FieldValue key={key} fieldKey={key} value={value} sectionKind={kind} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
