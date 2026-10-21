"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { SUPPORT_RESPONSE_SLA } from "@/lib/faq-content";

import { PEOPLE, type PersonKey } from "./landing-content";

function Hex({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`grid place-items-center [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)] ${className}`}
    >
      {children}
    </span>
  );
}

export function LandingHero({ primaryHref }: { primaryHref: string }) {
  const [person, setPerson] = useState<PersonKey>("founders");
  const current = PEOPLE[person];

  return (
    <section className="relative isolate px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-20">
      <div className="absolute left-1/2 top-[-10rem] -z-10 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-beedero-yellow/20 blur-[110px]" />
      <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
            The network for people in motion
          </p>
          <h1 className="mt-8 whitespace-pre-line text-[clamp(3.15rem,15vw,7.4rem)] font-black uppercase leading-[0.88] tracking-[-0.052em] sm:mt-7 sm:text-[clamp(3.7rem,7.5vw,7.4rem)] sm:leading-[0.84] sm:tracking-[-0.065em]">
            {current.line}
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
            {current.copy}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="rounded-full bg-beedero-yellow px-7 py-4 text-sm font-black uppercase text-beedero-black transition hover:-translate-y-0.5 hover:bg-white"
            >
              {current.action} →
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-white/25 px-7 py-4 text-sm font-black uppercase transition hover:bg-white hover:text-beedero-black"
            >
              It’s free to start
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/45">Free to join. {SUPPORT_RESPONSE_SLA}</p>
        </div>

        <div className="border border-beedero-yellow/45 bg-beedero-yellow p-3 text-beedero-black">
          <div className="bg-[#080907] p-5 text-white sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
                What brings you here?
              </p>
              <Hex className="h-10 w-10 bg-beedero-yellow text-beedero-black">↗</Hex>
            </div>
            <div className="mt-4 grid gap-2">
              {(Object.entries(PEOPLE) as [PersonKey, (typeof PEOPLE)[PersonKey]][]).map(
                ([key, item], i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPerson(key)}
                    className={`grid grid-cols-[35px_1fr_auto] items-center gap-3 border px-4 py-4 text-left transition ${
                      person === key
                        ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                        : "border-white/15 hover:border-beedero-yellow"
                    }`}
                  >
                    <span className="text-2xl opacity-50">0{i + 1}</span>
                    <span>
                      <b className="block text-sm font-black uppercase">{item.tab}</b>
                      <small
                        className={`mt-1 block text-xs ${
                          person === key ? "text-beedero-black/60" : "text-white/50"
                        }`}
                      >
                        {item.meta}
                      </small>
                    </span>
                    <span>{person === key ? "↗" : "+"}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
