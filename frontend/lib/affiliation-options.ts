export const ROLE_TYPE_OPTIONS = [
  { value: "founder", label: "Founder" },
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "volunteer", label: "Volunteer" },
  { value: "advisor", label: "Advisor" },
] as const;

export const AFFILIATION_STATUS_OPTIONS = [
  { value: "self_declared", label: "Self-declared" },
  { value: "pending", label: "Pending confirmation" },
  { value: "verified", label: "Verified" },
  { value: "disputed", label: "Disputed" },
] as const;

export function roleTypeLabel(value: string): string {
  return ROLE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function affiliationStatusLabel(value: string): string {
  return AFFILIATION_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
