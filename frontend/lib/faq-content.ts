import { LEGAL_ENTITY } from "./legal-content";

export const SUPPORT_RESPONSE_SLA = "We reply within 24 hours on business days.";

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Help, not sales copy. Each answer states what the product actually does
 * today — if something here stops being true, the answer changes or goes.
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Beedero?",
    answer:
      "Beedero is a network for startups where companies, teams and investors are verified. Personal accounts are free. An organisation gets a public page, jobs and a private fundraising section.",
  },
  {
    question: "Is Beedero free to join?",
    answer:
      "Personal accounts are free and stay free. Startups pay €33 a year or €3 a month; companies pay €99 a year or €9 a month, VAT included. With the EARLYADOPTER code an organisation's first year is free and no card is needed.",
  },
  {
    question: "How does company verification work?",
    answer:
      "We check the company against its certidão permanente — the Portuguese commercial registry certificate. You don't upload anything. This currently works for companies registered in Portugal.",
  },
  {
    question: "Can a startup be verified before it incorporates?",
    answer:
      "Yes. A startup that has no company yet is verified by hand: we read what the page says and look for whether a company of that name already exists. When you do incorporate, confirm the certidão permanente and the page keeps its history.",
  },
  {
    question: "How are professional roles verified?",
    answer:
      "The organisations you work with confirm your roles on Beedero. Until one of them does, a role on your profile is only your own word for it, and the profile says so.",
  },
  {
    question: "When does my profile appear in Discover?",
    answer:
      "Once your profile is complete enough to be worth finding — name, photo, what you do and at least one role. The profile page shows what is still missing.",
  },
  {
    question: "Can I import my LinkedIn profile?",
    answer:
      "Yes. Import from LinkedIn instead of typing everything again.",
  },
  {
    question: "Who can see fundraising details?",
    answer:
      "The ask, valuation, financials, data room and cap table are visible only to investors Beedero has verified. Investor verification is done by hand, one person at a time.",
  },
  {
    question: "Who can see my profile?",
    answer:
      "You choose who sees each section: everyone, verified investors, or no one. An organisation page stays a draft until you publish it.",
  },
  {
    question: "How fast do you reply to support?",
    answer: `${SUPPORT_RESPONSE_SLA} Write to ${LEGAL_ENTITY.contactEmail} — we read every message.`,
  },
  {
    question: "How do I delete my account?",
    answer: `From account settings, or by email to ${LEGAL_ENTITY.contactEmail}. We confirm and process the request under the Privacy Policy.`,
  },
];
