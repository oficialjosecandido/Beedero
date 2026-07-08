export const PRIVACY_POLICY_MARKDOWN = `
# Privacy Policy

Last updated: {date}

> ⚠️ INTERNAL NOTE — DO NOT PUBLISH WITHOUT REVIEW: this document is a technical draft prepared from how the platform actually works. It must be reviewed by a lawyer before publication. Points requiring a legal decision or confirmation are marked [LEGAL REVIEW: ...]. Fields in {braces} are placeholders to fill in.

## 1. Who we are

Beedero is a platform connecting startups and investors, operated by **{legal company name}**, headquartered at {address}, tax number (NIF) {NIF}, registered with the Commercial Registry of {location} ("Beedero", "we", "us").

We are the **data controller** for the personal data described in this policy, under the General Data Protection Regulation (GDPR).

**Privacy contact:** {email — e.g. privacy@beedero.com}

[LEGAL REVIEW: confirm whether appointment of a Data Protection Officer (DPO) is required given the volume and nature of processing; if so, include DPO contact details.]

## 2. What data we process, why, and on what legal basis

### 2.1 Account data

**What:** name, email, password (stored as a hash), email verification status.

**Why:** creating and managing your account, authentication, essential service communications.

**Legal basis:** performance of a contract (Art. 6(1)(b) GDPR).

**Retention:** for as long as the account exists; see §6 for deletion.

### 2.2 Profile data (person and organisation)

**What:** the information you choose to publish on your personal profile or your organisation's profile — description, team, products, market, milestones, financial and fundraising data, data room documents.

**Why:** making the profile available to other users **according to the visibility levels you set** (public / restricted / private). Restricted content is only accessible to those you grant access to; private content only to members of your organisation.

**Legal basis:** performance of a contract (Art. 6(1)(b)).

**Note:** you control the visibility of each field. Information marked as public is accessible to anyone on the internet, including search engines.

### 2.3 Credibility verification data

**What:** when you request verification of your organisation — tax number (NIF), permanent commercial registry certificate access code, tax and social security clearance certificates, financial statements, identification of the Certified Accountant (name and OCC registration number), and traction data obtained through integrations you authorise (e.g. Stripe, in read-only mode).

**Why:** verifying the identity, compliance and financial information of the organisation and awarding the corresponding credibility badges.

**Legal basis:** performance of a contract (Art. 6(1)(b)) as regards the organisation's data; as regards the Certified Accountant's data (a third party), legitimate interest (Art. 6(1)(f)) in verifying the authenticity of the accounts.

[LEGAL REVIEW: validate the basis for the Certified Accountant's data and any duty to inform that third party (Art. 14 GDPR); also validate the email confirmation process to the accountant when implemented.]

**Retention:** verification documents are kept for {X — proposed: 24 months after verification or until account deletion, whichever comes first}; badges and metadata (type, date, outcome) for as long as the profile exists.

[LEGAL REVIEW: confirm retention periods.]

**Storage:** documents are held in private storage, accessible only via temporary, logged links.

### 2.4 Activity and interest records ("who viewed what")

**What:** we record profile views (who viewed, when), access to restricted content and data room documents (including **IP address**), and interest signals (saving a startup, expressing interest, following).

**Why:** (a) security and auditing — on a platform where you share confidential information with investors, a record of who accessed what protects you; (b) insight features — showing an organisation's managers who has shown interest in their profile (we show your profile name, **never your email address**).

**Legal basis:** legitimate interest (Art. 6(1)(f)) — ours and our users' interest in the security and transparency of interactions on the platform.

[LEGAL REVIEW: this is the platform's most sensitive processing. Validate: (1) the legitimate interest assessment (LIA) for view tracking; (2) whether exposing the visitor's identity to the profile owner should instead rest on consent, or at least offer an opt-out ("private browsing" for investors); (3) the duty to provide clear information at the point of collection.]

**Retention:** profile views — {12 months}; audit records of access to restricted content — {24 months}, given their security purpose.

[LEGAL REVIEW: confirm retention periods.]

### 2.5 Technical data

**What:** IP address, session data (authentication cookies), technical error and performance logs.

**Why:** authentication, security (login attempt limits, abuse prevention), troubleshooting.

**Legal basis:** legitimate interest (Art. 6(1)(f)) in the security and operation of the service.

### 2.6 Communications

**What:** transactional emails (account verification, password recovery, verification expiry warnings, service notifications).

**Legal basis:** performance of a contract. Marketing communications, if any, only with consent (Art. 6(1)(a)) and with an opt-out in every message.

[LEGAL REVIEW: confirm e-Privacy/marketing framework where applicable.]

## 3. Cookies

We use **strictly necessary** cookies only: session cookies for authentication (httpOnly). We do not use advertising cookies or third-party tracking cookies.

[LEGAL REVIEW: if/when analytics are added (e.g. a third-party product), revisit this section and the need for a consent banner. With essential-only cookies, a banner should not be required — confirm.]

## 4. Who we share data with

We do not sell personal data. We share only with:

**Other users** — according to the visibility you set on your profiles and content, and as described in §2.4 (interest insight).

**Sub-processors** (providers processing data on our behalf under data processing agreements — Art. 28 GDPR):

| Sub-processor | Service | Location |
|---|---|---|
| Microsoft Azure | Hosting, database, file storage, email delivery | {region — e.g. European Union (West Europe)} |
| Stripe | Traction verification (read-only access authorised by you) | EU/US [LEGAL REVIEW: international transfers — SCCs/adequacy] |
| {Sentry or equivalent} | Error monitoring | {location} |
| {Managed Redis, if applicable} | Cache | {location} |

[LEGAL REVIEW: confirm the final list of sub-processors, each one's DPA, and the international transfer mechanism where applicable (EU-US adequacy decision / SCCs).]

**Authorities** — where legally required.

## 5. International transfers

Data is hosted in {Azure region in the EU}. Where a sub-processor involves a transfer outside the European Economic Area, it relies on {adequacy decision / standard contractual clauses}.

[LEGAL REVIEW: complete according to the actual contracts.]

## 6. Your rights

You have the right to access, rectify, erase, restrict and object to the processing of your data, as well as the right to data portability, under Articles 15 to 22 GDPR. To exercise these rights, contact {email}. We respond within one month.

**Account deletion:** you can delete your account at {path in the app / by request to email}. Deletion removes your personal data, with the following exceptions: (a) audit records of access to restricted content, which we keep for {24 months} for security and evidentiary reasons [LEGAL REVIEW: validate exception]; (b) content belonging to organisations with other members, which belongs to the organisation; (c) whatever the law requires us to keep.

[PRODUCT DECISION PENDING: what happens to an organisation whose sole owner deletes their account — delete the organisation, or orphan it with a recovery period? Decide before publishing.]

You also have the right to lodge a complaint with the **CNPD** (Portuguese Data Protection Authority — www.cnpd.pt) or your local supervisory authority.

## 7. Security

We apply appropriate technical and organisational measures, including: field-level access control enforced server-side and at the database level (Row-Level Security), encryption in transit (TLS), private document storage with access via temporary links, audit logging of access to restricted content, password hashing, and abuse limits.

## 8. Minors

Beedero is intended for people aged 18 or over. We do not knowingly collect data from minors.

[LEGAL REVIEW: confirm age threshold and wording.]

## 9. Changes to this policy

We will publish changes on this page and, where material, notify you by email or on the platform with reasonable notice.
`;
