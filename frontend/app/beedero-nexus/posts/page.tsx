import Link from "next/link";

import { ReasonAction } from "@/components/nexus/actions";
import { Avatar, Badge, Empty, FilterTabs, PageHeader, Pager, SearchForm, When } from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type Paged, type PostRow } from "@/lib/nexus";

type PostsPage = Paged<PostRow> & { reasons: { key: string; label: string }[]; can_restore: boolean };

const STATES = [
  { key: "live", label: "Published" },
  { key: "removed", label: "Removed" },
];

const SCOPES = [
  { key: "", label: "All" },
  { key: "orgs", label: "Organisations" },
  { key: "people", label: "People" },
];

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; scope?: string; page?: string }>;
}) {
  const { q, state = "live", scope = "", page } = await searchParams;
  const data = await nexusFetch<PostsPage>(`/nexus/posts/${query({ q, state, scope, page })}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Posts"
        title={state === "removed" ? "Removed posts." : "Everything public, newest first."}
        description="You see what any visitor sees. Posts an organisation shares only with its members stay private, here too. Removing a post hides it everywhere at once; the author is told why."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/beedero-nexus/posts" value={q} placeholder="Words, organisation or author" hidden={{ state, scope }} />
        <FilterTabs base="/beedero-nexus/posts" current={state} options={STATES} keep={{ q, scope }} param="state" />
      </div>
      <FilterTabs base="/beedero-nexus/posts" current={scope} options={SCOPES} keep={{ q, state }} param="scope" />

      {data.results.length === 0 ? (
        <Empty>{state === "removed" ? "Nothing has been removed." : "No posts match."}</Empty>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {data.results.map((post) => (
            <li key={post.id} className="flex flex-col border border-app-border bg-app-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {post.org ? (
                    <Avatar person={{ name: post.org.name, avatar: post.org.logo }} />
                  ) : post.author ? (
                    <Avatar person={post.author} />
                  ) : null}
                  <div className="min-w-0 text-xs">
                    {post.org ? (
                      <Link href={`/beedero-nexus/orgs/${post.org.slug}`} className="block truncate font-bold text-white hover:underline">
                        {post.org.name}
                      </Link>
                    ) : null}
                    {post.author && (
                      <Link href={`/beedero-nexus/users/${post.author.id}`} className="block truncate text-white/50 hover:underline">
                        {post.org ? `by ${post.author.name}` : post.author.name}
                      </Link>
                    )}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/40">
                  <Badge>{post.kind}</Badge>
                  <When at={post.created_at} />
                </span>
              </div>
              <h2 className="mt-3 text-base font-black text-white">{post.title}</h2>
              {post.body && <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm leading-6 text-white/65">{post.body}</p>}
              {post.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image} alt="" className="mt-3 max-h-48 w-full object-cover" />
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                <span className="text-[11px] text-white/40">
                  {post.reactions} reactions · {post.comments} comments · {post.impressions} views
                  {post.public_url && (
                    <>
                      {" · "}
                      <a href={post.public_url} target="_blank" rel="noreferrer" className="underline">
                        open ↗
                      </a>
                    </>
                  )}
                </span>
                {post.removed ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#ff8d82]">
                      Removed: {post.removed.reason_label} · {post.removed.by} · <When at={post.removed.at} />
                    </span>
                    {data.can_restore && (
                      <ReasonAction
                        label="Restore"
                        title="Restore this post"
                        description="It comes back everywhere. The author isn't told automatically."
                        path={`/nexus/posts/${post.id}/restore/`}
                        reasonField="note"
                        reasonRequired={false}
                        confirmLabel="Restore"
                        done="Restored."
                      />
                    )}
                  </span>
                ) : (
                  <ReasonAction
                    label="Remove"
                    title="Remove this post"
                    description={
                      <>
                        <b className="text-white">“{post.title}”</b> disappears from feeds and profiles at once. The author gets a
                        notification and an email with the reason you pick.
                      </>
                    }
                    path={`/nexus/posts/${post.id}/remove/`}
                    choices={data.reasons}
                    confirmLabel="Remove post"
                    tone="danger"
                    done="Post removed."
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager base="/beedero-nexus/posts" page={data.page} pages={data.pages} total={data.total} params={{ q, state, scope }} />
    </div>
  );
}
