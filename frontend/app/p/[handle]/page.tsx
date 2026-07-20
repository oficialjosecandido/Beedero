import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError, publicFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { COUNTRIES } from "@/lib/countries";
import { formatAtHandle } from "@/lib/handles";
import { pageMetadata } from "@/lib/site-metadata";

type PublicPerson = {
  person: {
    handle: string;
    full_name: string;
    headline: string;
    is_verified: boolean;
    profile_picture?: string | null;
    bio?: string;
    country?: string;
  };
  attestations: {
    kind: string;
    label: string;
    detail: string;
    org_slug?: string;
  }[];
  posts: {
    id: number;
    kind: string;
    title: string;
    body: string;
    occurred_at: string;
  }[];
};

const COUNTRY_NAMES = Object.fromEntries(COUNTRIES);

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  try {
    const data = (await publicFetch(`/public/people/${handle}/`)) as PublicPerson;
    const { person } = data;
    const title = person.full_name;
    const description =
      person.headline?.trim() ||
      `${person.full_name}'s verified startup profile on Beedero.`;
    return pageMetadata({
      title,
      description,
      path: `/p/${handle}`,
      image: person.profile_picture
        ? { url: person.profile_picture, alt: `${person.full_name} profile photo` }
        : undefined,
    });
  } catch {
    return { title: "Profile" };
  }
}

export default async function PublicPersonPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  let data: PublicPerson;
  try {
    data = await publicFetch<PublicPerson>(`/public/people/${handle}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { person, attestations, posts } = data;

  return (
    <main className="flex flex-1 justify-center px-4 py-12 lg:px-6 lg:py-16">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            {person.profile_picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.profile_picture}
                alt=""
                className="size-16 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-full bg-beedero-yellow/30 text-2xl font-extrabold text-beedero-black">
                {person.full_name.charAt(0)}
              </span>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-zinc-900">{person.full_name}</h1>
                {person.is_verified && (
                  <span className="rounded-full bg-beedero-yellow px-2.5 py-0.5 text-xs font-bold text-beedero-black">
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-600">{formatAtHandle(person.handle)}</p>
              {person.headline && <p className="mt-1 text-sm text-zinc-600">{person.headline}</p>}
              {person.country && (
                <p className="mt-1 text-xs text-zinc-400">
                  {COUNTRY_NAMES[person.country] ?? person.country}
                </p>
              )}
            </div>
          </div>

          {person.bio && (
            <p className="mt-6 text-sm leading-7 text-zinc-700">{person.bio}</p>
          )}

          {attestations.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                Platform-attested
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {attestations.map((item) => (
                  <li
                    key={`${item.kind}-${item.label}`}
                    className="rounded-xl border border-beedero-border/70 bg-zinc-50 px-4 py-3"
                  >
                    {item.org_slug ? (
                      <Link
                        href={`/o/${item.org_slug}`}
                        className="font-semibold text-beedero-black hover:underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <p className="font-semibold text-beedero-black">{item.label}</p>
                    )}
                    <p className="text-xs text-zinc-500">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {posts.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Activity</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {posts.map((post) => (
                  <li
                    key={post.id}
                    className="rounded-xl border border-beedero-border/70 px-4 py-3"
                  >
                    <p className="font-semibold text-zinc-900">{post.title}</p>
                    {post.body && <p className="mt-1 text-sm text-zinc-600">{post.body}</p>}
                    <p className="mt-1 text-xs text-zinc-400">{formatDate(post.occurred_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8 flex items-center gap-3 border-t border-beedero-border pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/pbadge/${handle}.svg`} alt="" className="h-10 w-auto" />
            <p className="text-xs text-zinc-500">
              Profile on{" "}
              <Link href="/" className="font-semibold text-beedero-black underline">
                Beedero
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
