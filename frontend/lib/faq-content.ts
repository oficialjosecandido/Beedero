export const SUPPORT_RESPONSE_SLA = "We reply within 24 hours on business days.";

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Beedero?",
    answer:
      "Beedero is a verified professional network for founders, talent, advisors, investors, startups and companies. Personal profiles are free. Organisations get a public page, verification ladder, jobs and private fundraising — without cold spam.",
  },
  {
    question: "Is Beedero free to join?",
    answer:
      "Yes. Personal accounts are free and stay free. Startups pay €33 a year or €3 a month; companies pay €99 a year or €9 a month, VAT included. With the EARLYADOPTER code, an organisation’s first year is free with no card. See Pricing for what’s included.",
  },
  {
    question: "How does founder verification work?",
    answer:
      "Founder status is verified against the company’s certidão permanente from the commercial registry — not self-declared. Pre-incorporation startups are confirmed by hand so you can be credible before you incorporate.",
  },
  {
    question: "How are professional roles verified?",
    answer:
      "Your roles are confirmed by the organisations you work with on Beedero. That confirmation turns self-declared experience into attested credibility on your profile.",
  },
  {
    question: "When do I appear in Discover?",
    answer:
      "A verification ladder shows what’s confirmed about you. From 50% you appear in Discover and can send connection requests.",
  },
  {
    question: "Can I import my LinkedIn profile?",
    answer:
      "Yes. Import from LinkedIn to set up your Beedero profile in minutes instead of starting from scratch.",
  },
  {
    question: "Who can see fundraising details?",
    answer:
      "Asks, valuation, financials, data room and cap table are shared only with verified investors — not with the public network.",
  },
  {
    question: "Who can see my profile?",
    answer:
      "You control visibility per section. Public pages are what search engines and other members can find; private sections stay behind your settings. Organisation pages stay draft until you publish them.",
  },
  {
    question: "How fast do you reply to support?",
    answer: `${SUPPORT_RESPONSE_SLA} Write to pt.bidnow@gmail.com — we read every message.`,
  },
  {
    question: "How do I delete my account?",
    answer:
      "You can request deletion from account settings or by emailing pt.bidnow@gmail.com. We’ll confirm and process the request under our Privacy Policy. Your data is also easy to export while your account is active.",
  },
];
