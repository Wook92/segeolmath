---
name: Toss payment reconciliation
description: Why Toss standard-checkout payments must be reconciled server-side, not just via the browser confirm callback.
---

# Toss standard checkout: never trust the browser to finalize payments

**Rule:** A Toss payment must be finalized server-side, independent of whether the
payer's browser returns to the success/result page. The browser `confirm` callback
is best-effort, not a guarantee.

**Why:** With Toss 표준결제, approval happens on Toss's side. If the browser fails
to return (network drop, closed tab) or the post-confirm DB write fails, the payment
is `DONE` on Toss but stays `pending` in our DB — a paid student shows 결제대기.
This actually happened in production with some students paid and others stuck.

**How to apply (the three layers, all sharing one idempotent finalize helper):**
1. confirm route — happy path (browser returns).
2. Toss webhook — server is notified directly. Each center must register the
   webhook URL in its Toss dashboard. Distrust the webhook body; re-query Toss by
   orderId and finalize only if status is DONE. Always return 200 (let the
   reconcile job be the backstop) so Toss doesn't retry forever.
3. Periodic reconcile job — the guaranteed safety net that works even if a center
   never registered the webhook. Scan pending notifications that have an orderId,
   re-query Toss, fix the ones that are DONE with a matching amount.

**Invariants to keep:**
- Validate amount before marking paid: our expected (sentAmount + textbookTotal)
  must equal Toss `totalAmount`. Never finalize on amount mismatch.
- Use compare-and-set (update only `WHERE status = pending`) so a concurrent
  webhook/reconcile/manual-cancel never overwrites an already-settled or cancelled
  row.
- Multi-center key selection for the re-query must try each source independently
  (center key -> system default key -> env) with per-source try/catch, so a single
  rotated/failing key falls through to the next source instead of aborting recovery.
