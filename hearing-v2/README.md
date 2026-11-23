# ALOPEX WEB CONCIERGE V2.0 — private development

Status: **BACKEND SCAFFOLD ONLY — NOT DEPLOYED, NOT CLIENT READY**.

## Source of truth
Existing 162 questions and 16 sections: `../hearing-v1.1/dist/schema.json`. Preserve all question IDs, wording, option values, conditional visibility, and required-field logic. Do not edit the V1.1 production application.

## Proposed flow
1. One public entry URL; enter company, contact, and email.
2. POST `/api/v2/start` creates a D1 draft and sends a 30-day opaque resume link to the email address. No answers are returned from the public entry.
3. GET/POST `/api/v2/draft` requires the 256-bit resume secret as a Bearer token. Server stores answers in D1.
4. POST `/api/v2/submit` forwards to a **new independent V2 GAS endpoint** and requires an idempotent receipt before marking a draft submitted. V1.1 GAS and Sheets remain unchanged.
5. A single V2 Google spreadsheet should contain submissions and answers with submission ID, company, contact, question ID, answer, timestamp; Gmail notification from GAS on confirmed save.

## Required before deployment
- Implement V2 client UI with schema validation, section navigation, progress, save/resume and submission confirmation.
- Create and verify a dedicated V2 GAS implementation with idempotent submission IDs, single-sheet data model, and notification failure retry.
- Configure D1, secret bindings, mail domain and deployment; never commit credentials.
- Add throttling/bot protection, deletion/retention rules, CSP and privacy notice; validate same-email abuse and mail delivery failure handling.
- Check complete 162-question preservation, conditional requirements, multi-company isolation, duplicate submits, concurrency, PC and actual smartphone.
- Ensure resume tokens are removed from browser URL after capture; no analytics/referrer leakage. Recommend shorter validity if client privacy policy requires it.
- Verify end-to-end saving, Gmail receipt and restoration before client release. Existing Rjb data/links must not be modified.

## Known limitations of scaffold
The current Worker is **not a production-ready secure deployment**. It lacks rate limiting, full schema validation, UI, GAS adapter, notification retry, and operational monitoring. Do not publish it or give its URL to clients. The GAS receipt contract is a new requirement, not a verified property of V1.1.
