import Link from "next/link";

import { getAccessToken, getRefreshToken } from "@/lib/session";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Beedero is free to join. Personal profiles and organisation accounts are free during early access.",
  path: "/pricing",
});

const INCLUDED = [
  "Personal profile",
  "Network discovery",
  "Messaging after connection",
  "Posts and milestones",
  "Follow people and organisations",
] as const;

export default async function PricingPage() {
  const authed = Boolean((await getAccessToken()) || (await getRefreshToken()));
  const joinHref = authed ? "/feed" : "/register";

  return (
    <main className="min-h-screen bg-[#070806] px-5 pb-10 text-white sm:px-8">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between pb-5 pt-[max(2rem,env(safe-area-inset-top))] sm:py-5">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.07em]">
          Beedero
        </Link>
        <Link
          href={joinHref}
          className="rounded-full bg-beedero-yellow px-5 py-2.5 text-xs font-black uppercase text-beedero-black"
        >
          Join
        </Link>
      </header>

      <section className="mx-auto max-w-[1280px] py-16 sm:py-24">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
          Simple by design
        </p>
        <h1 className="mt-6 max-w-4xl text-[clamp(3.5rem,8vw,7.5rem)] font-black uppercase leading-[0.82] tracking-[-0.09em]">
          You’re free
          <br />
          to get moving.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
          Joining, building your personal profile and finding your people costs nothing. It should.
        </p>

        <div className="mt-14 grid gap-3 lg:grid-cols-2">
          <section className="border border-white/15 bg-white/5 p-7 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
              Personal profile
            </p>
            <h2 className="mt-6 text-5xl font-black uppercase tracking-[-0.07em]">Free</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
              Your identity in the network: the work, relationships and opportunities that move with
              you.
            </p>
            <ul className="mt-9 space-y-3 border-t border-white/10 pt-6 text-sm">
              {INCLUDED.map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="text-beedero-yellow">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={joinHref}
              className="mt-10 inline-block rounded-full bg-beedero-yellow px-6 py-3.5 text-xs font-black uppercase text-beedero-black"
            >
              Create profile →
            </Link>
          </section>

          <section className="relative overflow-hidden border border-beedero-yellow bg-beedero-yellow p-7 text-beedero-black sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-black/55">
              Organisation
            </p>
            <h2 className="mt-6 text-5xl font-black uppercase tracking-[-0.07em]">Free, for now.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-beedero-black/70">
              An organisation account is how a company builds its presence, brings in its team and
              creates opportunities. It will be paid in the future — early access is on us.
            </p>
            <div className="mt-9 border-y border-black/15 py-6">
              <p className="text-sm font-bold">
                During early access, you get the full organisation experience at no cost.
              </p>
              <p className="mt-3 text-xs leading-5 text-beedero-black/60">
                We’ll be clear and give you notice before organisation pricing changes.
              </p>
            </div>
            <Link
              href={joinHref}
              className="mt-10 inline-block rounded-full bg-beedero-black px-6 py-3.5 text-xs font-black uppercase text-white"
            >
              Create organisation →
            </Link>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-white/45">
          No credit card. No surprise billing. No paywall around your professional identity.
        </p>
      </section>
    </main>
  );
}
