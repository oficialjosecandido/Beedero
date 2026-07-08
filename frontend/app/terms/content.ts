export const TERMS_OF_SERVICE_MARKDOWN = `
# Terms of Service

Last updated: {date}

> ⚠️ INTERNAL NOTE — DO NOT PUBLISH WITHOUT REVIEW. Same logic: a draft faithful to the product, with legal decisions flagged.

## 1. The service

Beedero, operated by {legal company name}, is an online platform where organisations (in particular startups) create profiles, control the visibility of their information, obtain credibility verification badges, and interact with investors and other users. By creating an account, you accept these Terms and the Privacy Policy.

## 2. What Beedero is NOT (important)

**Beedero is not a financial intermediary.** We are not brokers, we do not provide investment advice, we do not recommend investments, we do not intermediate, execute or facilitate securities transactions, and we do not receive any commission on investments made between users. The platform is limited to providing profiles, discovery tools and communication tools. Any investment decision is the sole responsibility of the parties, who should seek their own professional advice.

[LEGAL REVIEW: this section is critical given the regulated area (CMVM / securities regulation). Validate the wording and whether additional product safeguards are needed — e.g. disclaimers in the investor↔founder contact flow.]

## 3. Accounts and eligibility

- You must be at least 18 years old and provide truthful information.
- You are responsible for the security of your credentials and for activity on your account.
- A person who creates or manages an organisation's profile declares that they have the authority to represent it. [LEGAL REVIEW: reinforce with a declaration in the organisation creation flow?]

## 4. User content and visibility

- The content you publish remains yours. You grant Beedero a non-exclusive, worldwide, royalty-free licence to host, reproduce and display it **to the extent necessary to operate the service and in accordance with the visibility settings you choose**.
- You control the visibility (public/restricted/private) of each field. You acknowledge that: (a) public content is accessible to anyone; (b) restricted content is accessible to the people you grant access to, and Beedero does not control what those people do with information they access legitimately; (c) we log access to restricted content as described in the Privacy Policy.
- You are responsible for the accuracy of what you publish — including metrics and financial information.

## 5. Credibility verification

- Credibility badges reflect checks carried out by Beedero **based on the documents and connections you provide**, with the degree of certainty indicated on each badge (e.g. "document review").
- A badge does **not** constitute a guarantee, an audit, a legal certification of accounts, investment advice or due diligence. Investors must carry out their own diligence.
- Submitting false, tampered or third-party documents without authority is a serious breach of these Terms and may be reported to the authorities.
- Badges expire and may be revoked if we detect inaccuracies.

[LEGAL REVIEW: validate limitation of Beedero's liability for badges awarded in good faith on fraudulent documents.]

## 6. Prohibited conduct

Without prejudice to other rules: using the platform for unlawful purposes; publishing false or misleading information (including metrics); scraping or bulk-collecting other users' data; circumventing visibility or access controls; harassing other users; creating profiles for organisations you do not represent; using the platform for public offerings of securities outside the applicable legal frameworks.

## 7. Paid plans

The core of the platform is free. Additional analytics features ("Founder Pro") may be subscribed to for a fee, renewing {monthly}, cancellable at any time with effect at the end of the paid period. Prices and conditions on the pricing page.

[LEGAL REVIEW: right of withdrawal (14 days) in distance contracts with consumers — assess applicability to founders/companies (B2B vs B2C) and the wording of consent to immediate performance.]

## 8. Suspension and termination

We may suspend or terminate accounts that breach these Terms, with notice where reasonable. You may delete your account at any time (§6 of the Privacy Policy regarding data).

## 9. Liability

The service is provided "as is". To the maximum extent permitted by law, Beedero is not liable for: investment decisions made by users; the accuracy of content published by users; the use that third parties with legitimate access make of information; temporary unavailability. Nothing in these Terms excludes liability that cannot legally be excluded (intent, gross negligence, personal injury).

[LEGAL REVIEW: adapt the limitation of liability clause to Portuguese law — unfair standard terms, Decree-Law 446/85.]

## 10. Governing law and jurisdiction

These Terms are governed by Portuguese law. Jurisdiction: the courts of {Lisbon}, without prejudice to mandatory consumer protection rules. Alternative dispute resolution for consumer disputes: {applicable ADR body}.

[LEGAL REVIEW: confirm jurisdiction and mandatory ADR/ODR references.]

## 11. Changes

We may change these Terms, notifying material changes {30 days} in advance. Continued use after they take effect constitutes acceptance.

---

## Checklist for legal review (hand to the lawyer)

To make the review fast, these are the concrete open questions, in order of importance:

1. **Terms §2 (no financial intermediation):** validate wording and product safeguards against securities regulation (CMVM). This is the business's central regulatory risk.
2. **Privacy §2.4 ("who viewed what" tracking):** LIA for legitimate interest; consent vs. opt-out for exposing the visitor's identity; information text at the point of collection.
3. **Retention periods** proposed ({12m} views, {24m} audit, {24m} verification docs) — confirm or adjust.
4. **Account deletion:** retention exceptions (audit) + product decision on orphaned organisations.
5. **Certified Accountant's data** (third party): legal basis + duty to inform (Art. 14) + email confirmation process.
6. **Sub-processors and international transfers:** final list, DPAs, SCCs/adequacy (especially Stripe and Sentry).
7. **DPO:** required or not.
8. **Terms §5:** limitation of liability regarding credibility badges.
9. **Terms §7:** right of withdrawal B2C vs B2B for Founder Pro.
10. **Cookies:** confirmation that, with essential-only cookies, no banner is required.
`;
