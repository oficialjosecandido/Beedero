export const SUPPORT_RESPONSE_SLA = "We reply within 24 hours on business days.";

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Beedero?",
    answer:
      "Beedero is a professional network for founders, operators, investors and organisations. You build a structured profile, get discovered for the work you’re doing, and grow credibility through organisation-confirmed roles and milestones.",
  },
  {
    question: "Is Beedero free to join?",
    answer:
      "Yes. Creating a personal profile and joining the network is free, and stays free. Organisations pay €99 a year or €9 a month, VAT included — and early adopters get the first year free, with no card. See Pricing for what’s included.",
  },
  {
    question: "How does verification work?",
    answer:
      "Self-declared experience starts as just that. When an organisation on Beedero confirms your role — or when you sit on its team roster — that fact becomes verified by the organisation. Founder claims via company registry follow a separate review path.",
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
      "You can request deletion from account settings or by emailing pt.bidnow@gmail.com. We’ll confirm and process the request under our Privacy Policy.",
  },
];
