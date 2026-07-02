import { OrgProfile as OrgProfileData, SECTION_LABELS } from "@/lib/types";

function FieldValue({ value }: { value: unknown }) {
  if (value && typeof value === "object" && "title" in (value as Record<string, unknown>)) {
    const post = value as { title: string; body?: string; occurred_at?: string };
    return (
      <div>
        <p className="font-medium">{post.title}</p>
        {post.body && <p className="text-sm text-zinc-600">{post.body}</p>}
        {post.occurred_at && (
          <p className="text-xs text-zinc-400">
            {new Date(post.occurred_at).toLocaleDateString()}
          </p>
        )}
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
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold">{data.org.name}</h1>
          {data.org.is_verified && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Verified
            </span>
          )}
          {data.org.is_fundraising && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Fundraising
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500">/o/{data.org.slug}</p>
      </header>

      {sectionEntries.length === 0 && (
        <p className="text-sm text-zinc-500">Nothing visible to you on this page.</p>
      )}

      {sectionEntries.map(([kind, fields]) => (
        <section key={kind} className="flex flex-col gap-3 border-t border-zinc-200 pt-4">
          <h2 className="text-lg font-medium">{SECTION_LABELS[kind] ?? kind}</h2>
          <div className="flex flex-col gap-3">
            {Object.entries(fields).map(([key, value]) => (
              <FieldValue key={key} value={value} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
