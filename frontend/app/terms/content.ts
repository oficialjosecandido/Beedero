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

## 7. Subscriptions

- **Who pays.** Personal accounts are free. Each organisation on Beedero needs a subscription: **€99 per year** or **€9 per month**. Prices include VAT.
- **What it covers.** While an organisation has an active subscription — including a free period — it can be published and listed in Discover, post updates, milestones and events, and publish jobs. Personal profiles, connections and messages never depend on it.
- **Free year.** A promotional code (such as EARLYADOPTER) gives an organisation its first year free, and organisations that already existed when subscriptions were introduced receive the same free year automatically. No payment method is needed. There is one free period per organisation. We remind owners and admins 30, 7 and 1 days before it ends. If no payment method has been added by then, the subscription pauses and nothing is charged.
- **Payment and renewal.** Payments are processed by Stripe; we never see or store your card number. A paid subscription renews automatically at the end of each period (year or month) and is charged to the payment method on file until it is cancelled. If you add a payment method during the free year, the first charge is made on the day the free year ends.
- **Failed payments and pauses.** If a payment fails, it is retried for a limited period and the organisation keeps working in the meantime. If the subscription is cancelled, ends or remains unpaid, the organisation is **paused**: its public page stays online, but it is hidden from Discover and cannot post or publish jobs. Its content and verification history are kept, and a new subscription resumes it.
- **Cancellation.** Owners and admins can cancel at any time in the organisation's workspace (Plan → Manage billing). Cancellation takes effect at the end of the period already paid, without a refund for the remainder of that period, except as set out in the next point.
- **14-day refund.** Within 14 days of the first payment of a subscription, you may cancel and receive a full refund by writing to {email}. This does not limit any right you have as a consumer.
- **Invoices.** Payments are invoiced by {legal company name}. Stripe emails a receipt for each payment and the invoice (fatura) is sent by email. To have the organisation's VAT number on the invoice, add it at checkout or in Manage billing.
- **Price changes.** We may change prices for future periods. We will notify owners at least 30 days before a new price applies to their organisation; they can cancel before it does.
- **Authority.** Whoever creates an organisation or manages its subscription declares that they can act on its behalf.

[LEGAL REVIEW: (1) right of withdrawal in distance contracts with consumers (Decree-Law 24/2014) — the 14-day full refund on the first payment is meant to cover it; confirm the wording and whether express consent to immediate performance is still required at checkout; (2) automatic renewal, pausing and the price-change notice under Decree-Law 446/85 (unfair standard terms) and consumer law; (3) VAT-inclusive pricing for business customers in other EU member states (reverse charge) — confirm with the certified accountant; (4) Stripe receipts are not Portuguese invoices — confirm the certified invoicing process (faturação certificada).]

## 8. Suspension and termination

We may suspend or terminate accounts that breach these Terms, with notice where reasonable. You may delete your account at any time (see the Privacy Policy regarding data).

If an organization has a single owner and that owner deletes their account, the organization is archived. Content remains stored for 30 days and may be transferred to another member on request to {email}.

## 9. Language

If these Terms are published in more than one language, the Portuguese version prevails in case of conflict.

## 10. Liability

The service is provided "as is". To the maximum extent permitted by law, Beedero is not liable for: investment decisions made by users; the accuracy of content published by users; the use that third parties with legitimate access make of information; temporary unavailability. Nothing in these Terms excludes liability that cannot legally be excluded (intent, gross negligence, personal injury).

[LEGAL REVIEW: adapt the limitation of liability clause to Portuguese law — unfair standard terms, Decree-Law 446/85.]

## 11. Governing law and jurisdiction

These Terms are governed by Portuguese law. Jurisdiction: the courts of {Lisbon}, without prejudice to mandatory consumer protection rules. Alternative dispute resolution for consumer disputes: {applicable ADR body}.

[LEGAL REVIEW: confirm jurisdiction and mandatory ADR/ODR references.]

## 12. Changes

We may change these Terms, notifying material changes {30 days} in advance. Continued use after they take effect constitutes acceptance.

---

These Terms were last reviewed for publication on {date}.
`;
