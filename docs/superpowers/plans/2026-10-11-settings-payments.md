# Payment Settings and Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep counter cash as the only payment method the shop settles today, with durable transaction state and an explicit staff confirmation, and defer bKash/Nagad MFS plus automatic refunds to a future version.

**Decision (owner, 2026-10-11):** The shop keeps the existing cash-counter flow. bKash/Nagad integration and automatic refunds are not implemented now; they are planned for a future version, so nothing may present an MFS or uncollected payment as paid.

**Architecture:** Persist counter-cash transactions locally in SQLite with a pending → confirmed/failed lifecycle. A payment is created as pending for the job, and only an operator confirmation (`confirmedBy`) marks the cash as collected. No provider adapter exists while no merchant MFS provider is selected, and the local gateway rejects customer orders that claim an MFS or already-collected payment.

**Tech Stack:** TypeScript, existing `better-sqlite3`, Node test runner.

**Spec:** `docs/design/specs.md` Settings Panel.

## Global Constraints

- Never report an order as paid unless the counter collected the cash or a payment adapter confirms it.
- Never store or log payment secrets, card data, or customer financial credentials.
- A deferred MFS request (`bkash`, `nagad`) must fail loudly instead of creating a paid transaction.
- Refunds and automatic refunds are out of scope until a merchant provider is integrated.
- Do not add provider SDK dependencies before provider selection.

## Review Focus

- A customer order that claims `paid_mfs` or `paid_counter` is rejected at the gateway and never enters the queue as paid.
- Counter-cash payment creation is idempotent; a repeated key with different data is rejected.
- Only staff confirmation moves a payment to confirmed, and invalid staff identifiers are rejected.
- Failed payments cannot be confirmed and confirmed payments cannot fail.
- The customer PWA cannot select bKash/Nagad while the methods are deferred.

---

### Task 1: Counter-cash payment domain and store

**Files:**
- `src/shared/payments.ts`
- `electron/services/payment-store.ts`
- `electron/services/payment-service.ts`
- `electron/services/__tests__/payment-service.test.ts` (listed in `npm run test:desktop`)

**Interfaces:**
- `PaymentMethod` is `counter_cash`; `DeferredPaymentMethod` (`bkash`, `nagad`) exists only so the boundary can reject it with a future-version message.
- `PaymentService` exposes `createPayment`, `confirmCashPayment({ paymentTransactionId, confirmedBy })`, `failPayment`, and `getPayment`.
- `PaymentStore` persists pending/confirmed/failed transactions with a positive whole-BDT amount, BDT currency, and a unique idempotency key.

- [x] **Step 1: Test create/confirm/fail transitions, idempotency, deferred-method rejection, and invalid staff identifiers.**
- [x] **Step 2: Implement the SQLite transaction store and counter-cash payment service.**
- [x] **Step 3: Run the focused payment tests and lint.**

### Task 2: Customer-order and Settings policy

**Files:**
- `src/features/customer-pwa/CustomerPwaView.tsx`
- `src/shared/services/customerPolicy.ts`
- `electron/services/local-gateway.ts`
- `src/features/desktop/pages/settingsGroups.ts`
- `src/features/desktop/pages/SettingsPage.tsx`
- `src/shared/i18n/strings.ts`

**Interfaces:**
- `validateCustomerOrderPayment` accepts only `counter_cash` + `unpaid`; the gateway answers `400` for anything else.
- The customer PWA offers counter cash only and marks the bKash/Nagad card as a future version.
- Settings → পেমেন্ট shows **Pay at counter (cash)** as always on, and keeps payment methods and automatic refunds marked Coming soon.

- [x] **Step 1: Test the customer-order payment policy in the renderer and gateway suites.**
- [x] **Step 2: Apply the policy in the PWA, the gateway, and the Settings metadata.**
- [ ] **Step 3: Wire the payment service to Electron IPC and an operator “cash received” action, then mark it supported in Settings.**
- [ ] **Step 4: Add bKash/Nagad settlement, provider references, and refunds in a future version.**

### Deferred work (future version)

- Merchant MFS integration for bKash/Nagad, including provider credentials, settlement verification, and provider references.
- Refund transactions and the automatic-refund-on-rejection setting.
- IPC bridge calls (`createPayment`, `confirmCashPayment`, `failPayment`) once an operator confirmation action exists in the UI.
