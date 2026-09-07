export const ENGAGEMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "volunteer", label: "Volunteer" },
  { value: "cofounder", label: "Co-founder" },
  { value: "advisor", label: "Advisor" },
] as const;

export const LOCATION_TYPE_OPTIONS = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const COMPENSATION_KIND_OPTIONS = [
  { value: "salary", label: "Salary" },
  { value: "equity", label: "Equity" },
  { value: "stock_options", label: "Stock options" },
  { value: "revenue_share", label: "Revenue share" },
  { value: "other", label: "Other" },
] as const;

export const APPLICATION_STATUS_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "viewed", label: "Viewed" },
  { value: "interested", label: "Interested" },
  { value: "declined", label: "Declined" },
  { value: "hired", label: "Hired" },
] as const;

export function engagementTypeLabel(value: string): string {
  return ENGAGEMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function locationTypeLabel(value: string): string {
  return LOCATION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function compensationKindLabel(value: string): string {
  return COMPENSATION_KIND_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function applicationStatusLabel(value: string): string {
  return APPLICATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
