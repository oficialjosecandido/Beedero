export const PEOPLE = {
  founders: {
    tab: "Founders",
    line: "Build the thing.\nFind your people.",
    copy: "A profile that turns your progress into introductions, hires and investor conversations.",
    action: "Build my profile",
    meta: "Build · hire · raise",
  },
  professionals: {
    tab: "Professionals",
    line: "Your next role\nknows your name.",
    copy: "Put your experience in front of founders and teams looking for exactly what you know.",
    action: "Show my work",
    meta: "Advise · join · contribute",
  },
  companies: {
    tab: "Companies",
    line: "Be worth\nlooking up.",
    copy: "Give your organisation a credible home for its story, team, jobs and milestones.",
    action: "Create an organisation",
    meta: "Tell · attract · grow",
  },
  investors: {
    tab: "Investors",
    line: "Find the signal\nbefore the noise.",
    copy: "See the context around the companies and people worth meeting next.",
    action: "Discover the network",
    meta: "Find · meet · back",
  },
} as const;

export type PersonKey = keyof typeof PEOPLE;

export const BENEFITS = [
  ["01", "Founders", "Get discovered for the work you’re actually doing.", "/for-founders"],
  ["02", "Professionals", "Turn experience into roles, advisory and board opportunities.", "/for-professionals"],
  ["03", "Startups", "Verified without paperwork — priced for the beginning.", "/for-startups"],
  ["04", "Companies", "Registry-confirmed pages for fundraising and hiring.", "/for-companies"],
] as const;
