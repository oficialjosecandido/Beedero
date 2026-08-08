export const ENGAGEMENT_OPTIONS = [
  { value: "advisory", label: "Advisory" },
  { value: "board", label: "Board" },
  { value: "fractional", label: "Fractional" },
] as const;

export const EXPERTISE_OPTIONS = [
  { value: "fundraising", label: "Fundraising" },
  { value: "gtm_sales", label: "GTM & sales" },
  { value: "product", label: "Product" },
  { value: "engineering", label: "Engineering" },
  { value: "people_hiring", label: "People & hiring" },
  { value: "finance_ops", label: "Finance & ops" },
  { value: "legal_compliance", label: "Legal & compliance" },
  { value: "marketing_brand", label: "Marketing & brand" },
  { value: "international_expansion", label: "International expansion" },
  { value: "other", label: "Other" },
] as const;

export function engagementLabel(value: string): string {
  return ENGAGEMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function expertiseLabel(value: string): string {
  return EXPERTISE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
