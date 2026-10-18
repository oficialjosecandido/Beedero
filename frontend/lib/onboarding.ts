/**
 * Where somebody goes after onboarding — doc §6.4's table, "Primeiro ecrã
 * consoante a intenção":
 *
 *   | Procurar emprego  | Vagas da cidade/área + "completa o perfil…"      |
 *   | Procurar cofundador | Ativar o perfil de cofundador                 |
 *   | Investir          | Startups verificadas + ativar o pipeline        |
 *   | Construir startup | Criar a org (e convidar a equipa — Ciclo 1)     |
 *   | Conhecer          | Sugestões para seguir + feed                    |
 *
 * The routes are here rather than in the API because they are Next routes: the
 * backend knows the intent, this file knows what page answers it. The priority
 * for somebody who chose several is the vocabulary order in
 * `accounts/intents.py`, which is this table's order — decided there, not here.
 *
 * `nudge` is the second half of each row: the sentence the table pairs with the
 * screen. It is rendered once, on arrival, by `WelcomeNudge`, which is why the
 * destination carries `?welcome=<intent>` — the landing pages are ordinary
 * pages and should not grow an onboarding branch each.
 */

export type FirstScreen = {
  /** Path to land on, before `?welcome=` is added. */
  path: string;
  /** The §6.4 sentence shown once on arrival. */
  nudge: string;
  /** Where the nudge's own call to action goes. */
  actionPath: string;
  actionLabel: string;
};

const FIRST_SCREENS: Record<string, FirstScreen> = {
  job: {
    // The public board, not /opportunities: it is the one with city and area
    // filters, which is exactly what "vagas da cidade/área" asks for.
    path: "/jobs",
    nudge: "Complete your profile and you'll apply in one click next time.",
    actionPath: "/profile",
    actionLabel: "Finish your profile",
  },
  cofounder: {
    path: "/cofounder",
    nudge: "Activate your co-founder profile to start being matched.",
    actionPath: "/cofounder",
    actionLabel: "Activate it",
  },
  invest: {
    path: "/startups",
    nudge: "Track the startups you're watching by activating your pipeline.",
    actionPath: "/pipeline",
    actionLabel: "Activate pipeline",
  },
  build: {
    path: "/dashboard",
    nudge: "Create your organisation, then invite the people who build it with you.",
    actionPath: "/dashboard",
    actionLabel: "Create an organisation",
  },
  explore: {
    path: "/feed",
    nudge: "Follow a few more startups and your feed fills itself.",
    actionPath: "/startups",
    actionLabel: "Discover startups",
  },
};

const FALLBACK = FIRST_SCREENS.explore;

export function firstScreenFor(intent: string): FirstScreen {
  return FIRST_SCREENS[intent] ?? FALLBACK;
}

/**
 * Whether this is one of `accounts/intents.py`'s values. `firstScreenFor`
 * answers everything, which is right for routing — somebody who ticked nothing
 * still has to land somewhere — but wrong for the nudge: a hand-edited
 * `?welcome=` should produce silence, not advice about exploring.
 */
export function isIntent(value: string | null | undefined): boolean {
  return Boolean(value && value in FIRST_SCREENS);
}

/**
 * The full destination, including the `welcome` flag and — for the job
 * board — the city, which is the "da cidade" half of §6.4's first row.
 */
export function firstScreenUrl(intent: string, city: string): string {
  const screen = firstScreenFor(intent);
  const params = new URLSearchParams();
  if (intent === "job" && city.trim()) params.set("city", city.trim());
  params.set("welcome", FIRST_SCREENS[intent] ? intent : "explore");
  return `${screen.path}?${params.toString()}`;
}
