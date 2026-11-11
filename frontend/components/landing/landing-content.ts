/**
 * Home-page copy. Short on purpose: the earlier version said what Beedero is
 * eight different ways, showed results that did not exist, and repeated the
 * FAQ. Everything here is either true today or renders nothing.
 */

/**
 * José's own note, for the second block of the home page and for /about.
 *
 * His words, his reason — tightened, not written for him. Both places render
 * nothing while `body` is empty, so this stays the one piece of copy on the
 * site that nobody but him can supply.
 */
export const FOUNDER_NOTE = {
  name: "José Cândido",
  role: "Founder",
  body:
    "Many times I've seen LinkedIn profiles that are not true to the person, and companies claiming to be something they are not. That is why I built Beedero. It is a work in progress, and it needs people on it — not an AI tool — to be worth anything.",
  linkedin: "https://www.linkedin.com/in/jvcandido",
} as const;

/**
 * What the product does today. Three, because there are three worth showing —
 * and each one is something you can go and use after signing up.
 */
export const WHAT_WORKS = [
  {
    title: "A profile your employer signs off",
    body: "Add a role and the organisation confirms it. Anything unconfirmed says so on the page, so nobody has to take your word for it.",
  },
  {
    title: "A page that can be looked up",
    body: "A company is checked against its certidão permanente at the commercial registry. A startup with no company yet is verified by hand.",
  },
  {
    title: "A round investors see and nobody else does",
    body: "Your ask, valuation, data room and cap table go only to investors we have verified. Nothing of it is public.",
  },
] as const;
