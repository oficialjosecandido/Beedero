import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import { noIndexMetadata, pageMetadata } from "@/lib/site-metadata";
import type { IntentOption, OnboardingState, OnboardingSuggestions } from "@/lib/types";

import { ExperienceStep } from "./ExperienceStep";
import { IdentityForm } from "./IdentityForm";
import { IntentsForm } from "./IntentsForm";
import { SuggestionsStep } from "./SuggestionsStep";

/**
 * Doc §6.3 — "Onboarding da pessoa em três passos", plus the closing
 * suggestions screen the same section asks for.
 *
 * Four URLs, one page: `?step=` is the whole state. The alternative, a client
 * component holding the step in memory, loses the flow on a refresh and cannot
 * server-render the suggestions — and a person who closes the tab at step 2
 * should come back to step 2, not to the beginning.
 *
 * Nothing here is a wall. Steps 2 and 3 are explicitly skippable and skipping
 * them still ends at "Done"; only step 1 is required, because a name and a
 * city are what the rest of the flow is made of.
 */

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Set up your profile",
    description: "Three steps: who you are, what brings you here, and your track record.",
    path: "/onboarding",
  }),
  ...noIndexMetadata,
};

const STEPS = ["identity", "intents", "experience", "suggestions"] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Step, { eyebrow: string; title: string; blurb: string }> = {
  identity: {
    eyebrow: "Step 1 of 3",
    title: "Who you are",
    blurb: "Your name, your address on Beedero, and the city you work from.",
  },
  intents: {
    eyebrow: "Step 2 of 3",
    title: "What brings you here",
    blurb: "Pick as many as apply. This stays private — it only decides what we show you.",
  },
  experience: {
    eyebrow: "Step 3 of 3",
    title: "Your track record",
    blurb: "Add one role to start with. You can skip this and do it later.",
  },
  suggestions: {
    eyebrow: "Last thing",
    title: "People and startups to follow",
    blurb: "So your feed has something in it the first time you open it.",
  },
};

function stepFrom(value: string | undefined): Step {
  return STEPS.includes(value as Step) ? (value as Step) : "identity";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const step = stepFrom((await searchParams).step);

  let state: OnboardingState;
  try {
    state = await apiFetch<OnboardingState>("/onboarding/");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login?next=/onboarding");
    throw err;
  }

  // The one order that is enforced: step 1 writes the name and the city, and
  // the suggestions are built from that city. Landing deeper without it — a
  // bookmark, a back button — would show an empty screen and blame the person.
  if (step !== "identity" && (!state.full_name || !state.city)) {
    redirect("/onboarding");
  }

  const [options, suggestions] = await Promise.all([
    step === "intents"
      ? // `{items: […]}`, like every other list endpoint here (/feed/,
        // /trending/) — not a bare array.
        safeFetch(apiFetch<{ items: IntentOption[] }>("/onboarding/intents/"), { items: [] })
      : Promise.resolve({ items: [] as IntentOption[] }),
    step === "suggestions"
      ? // A quiet failure here must not block the last step: the screen is a
        // courtesy, and "Done" is the only thing on it that has to work.
        safeFetch(apiFetch<OnboardingSuggestions>("/onboarding/suggestions/"), {
          city: state.city,
          is_local: false,
          orgs: [],
          people: [],
        })
      : Promise.resolve(null),
  ]);

  const copy = COPY[step];
  const position = STEPS.indexOf(step);

  return (
    <main className="flex flex-1 flex-col items-center bg-beedero-white px-4 py-10 text-beedero-black sm:px-6 sm:py-14">
      <div className="flex w-full max-w-xl flex-col gap-7">
        <div className="flex flex-col gap-3">
          <ol aria-label="Progress" className="flex items-center gap-2">
            {STEPS.map((name, index) => (
              <li
                key={name}
                aria-current={name === step ? "step" : undefined}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= position ? "bg-beedero-black" : "bg-beedero-border"
                }`}
              >
                <span className="sr-only">{COPY[name].title}</span>
              </li>
            ))}
          </ol>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              {copy.eyebrow}
            </p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{copy.blurb}</p>
          </div>
        </div>

        {step === "identity" && <IdentityForm state={state} />}
        {step === "intents" && <IntentsForm options={options.items} selected={state.intents} />}
        {step === "experience" && <ExperienceStep />}
        {step === "suggestions" && suggestions && <SuggestionsStep data={suggestions} />}
      </div>
    </main>
  );
}
