import Link from "next/link";

const audiences = [
  {
    title: "Founders",
    text: "Build a trusted profile once, then decide exactly what investors, partners, and talent can see.",
  },
  {
    title: "Startups",
    text: "Show traction, team, products, fundraising, and research signals without losing control of sensitive data.",
  },
  {
    title: "Job seekers",
    text: "Discover ambitious companies early and follow the ones building in markets you care about.",
  },
  {
    title: "Investors",
    text: "Track verified opportunities, follow updates, and request access to the details behind the headline.",
  },
  {
    title: "Researchers",
    text: "Map sectors, geographies, and innovation patterns from profiles that stay structured over time.",
  },
];

const metrics = [
  ["5+", "profile fields before updates"],
  ["24/7", "controlled discovery"],
  ["1", "source of truth per startup"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-beedero-black text-beedero-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>
        <div className="hidden items-center gap-6 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-white/70 sm:flex">
          <Link href="/discovery" className="hover:text-beedero-white">
            Discovery
          </Link>
          <Link href="/pricing" className="hover:text-beedero-white">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-beedero-white">
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-beedero-yellow px-5 py-2 text-beedero-black hover:bg-beedero-white"
          >
            Join
          </Link>
        </div>
      </nav>

      <section className="relative isolate overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-28 lg:pt-20">
        <div className="absolute left-1/2 top-12 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-beedero-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
              Founder-led discovery network
            </p>
            <h1 className="max-w-5xl text-6xl font-black uppercase leading-[0.82] tracking-[-0.08em] sm:text-8xl lg:text-[9.5rem]">
              Build the company graph before everyone else sees it.
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-medium leading-8 text-beedero-white/70 sm:text-xl">
              Beedero connects founders, startups, job seekers, investors, and
              researchers around structured company profiles, controlled access,
              and a live feed of meaningful updates.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="rounded-full bg-beedero-yellow px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-white"
              >
                Create your profile
              </Link>
              <Link
                href="/discovery"
                className="rounded-full border border-beedero-white/25 px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-white hover:border-beedero-white hover:bg-beedero-white hover:text-beedero-black"
              >
                Explore startups
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-beedero-white/10 bg-beedero-white p-3 text-beedero-black shadow-2xl shadow-beedero-yellow/10">
            <div className="rounded-[1.5rem] bg-beedero-yellow p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em]">
                Live startup signal
              </p>
              <div className="mt-16 rounded-3xl bg-beedero-black p-5 text-beedero-white">
                <p className="text-sm text-beedero-white/60">Today&apos;s focus</p>
                <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-[-0.06em]">
                  Follow teams. Unlock proof. Hire earlier.
                </h2>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {metrics.map(([value, label]) => (
                  <div key={value} className="rounded-2xl bg-beedero-white/80 p-4">
                    <p className="text-2xl font-black tracking-[-0.06em]">{value}</p>
                    <p className="mt-1 text-xs font-bold uppercase leading-4 text-beedero-black/60">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-beedero-white px-5 py-16 text-beedero-black sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-black/50">
                Who it is for
              </p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-[-0.07em] sm:text-7xl">
                One network, five entry points.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {audiences.map((audience) => (
                <article
                  key={audience.title}
                  className="rounded-[1.5rem] border border-beedero-black/10 bg-beedero-yellow/20 p-6"
                >
                  <h3 className="text-2xl font-black uppercase tracking-[-0.06em]">
                    {audience.title}
                  </h3>
                  <p className="mt-4 text-sm font-medium leading-6 text-beedero-black/65">
                    {audience.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-beedero-white/10 bg-beedero-black p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-beedero-yellow">
                Start now
              </p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.07em] sm:text-6xl">
                Claim your place in the startup discovery layer.
              </h2>
            </div>
            <Link
              href="/register"
              className="rounded-full bg-beedero-white px-8 py-4 text-center text-sm font-black uppercase tracking-[-0.02em] text-beedero-black hover:bg-beedero-yellow"
            >
              Join Beedero
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
