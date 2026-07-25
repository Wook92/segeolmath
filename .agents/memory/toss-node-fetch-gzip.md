---
name: Toss + node-fetch gzip premature close
description: why all Toss API calls disable gzip and retry, and confirm must self-heal
---

# Toss API calls must disable gzip and be idempotently retried

All Toss (tosspayments) API calls in `server/toss-payments.ts` go through one wrapper
that sets node-fetch `compress: false` and retries transient network/stream errors.

**Why:** node-fetch v2 requests gzip and decompresses via a Gunzip stream. Toss's
gzip responses intermittently trigger `ERR_STREAM_PREMATURE_CLOSE` while reading the
body, so `confirmPayment` threw even though Toss had already approved the charge —
users saw "결제 대기" for real, completed payments. `compress: false` removes the
Gunzip path entirely; retries cover transient resets. Confirm/billing are idempotent
by paymentKey/orderId, so retrying does not double-charge.

**How to apply:** Never call the Toss API with raw `fetch`/node-fetch directly — use
the shared wrapper so gzip stays off. When adding a new Toss endpoint, route it
through the wrapper too. For any charge-then-confirm flow, treat a lost confirm
response as "possibly charged": re-query real payment status and finalize only when
status is DONE, rather than assuming failure. Webhook + periodic reconcile remain the
backstops.
