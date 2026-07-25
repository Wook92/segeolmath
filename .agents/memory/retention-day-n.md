---
name: Retention Day-N analytics
description: How Day1/7/30 re-visit retention is computed and the "not yet measurable" rule
---

# Day-N retention is forward-looking → recent days are not measurable yet

Endpoints: `GET /api/centers/:centerId/retention-stats` and `GET /api/all-centers/retention-stats` (server/routes.ts).
Day-N retention = of users active on day D, how many returned on calendar day D+N.

**Rule:** if D+N is after today, the value is NOT 0 — it is *not yet measurable*. Return `null`, and average only non-null days (avg is `null` when no measurable day exists).

**Why:** the retention tab defaults to the current month. Counting future-target days as a measured 0% made Day30 average collapse to ~0 and looked like "Day30 not aggregating." Past, fully-elapsed months computed fine.

**How to apply:** any new Day-N metric or UI must distinguish `null` (측정 중) from `0%`. Frontend (center-usage-stats.tsx, centers.tsx) types these as `number | null`, renders null as "측정 중", and getRetentionColor is null-safe.

**Other notes:**
- Server runs UTC; per-center buckets visits by UTC date, all-centers buckets by KST (+9h) — a pre-existing inconsistency, not changed here.
- Per-center fetch window must extend ~10 days into month+2 (`new Date(year, month+1, 10)`) so month-end Day30 targets are fetched.

# "전체 이용자 수" (totalMembers) is month-scoped, best-effort

`totalMembers` in both retention endpoints must reflect the *selected month*, not the current headcount.
`user_centers` has NO timestamp columns, so we scope by joining `users` and filtering `users.createdAt <= monthEnd`.

**Why:** counting raw `user_centers` rows always returned today's membership, so changing the month never changed the number.
**Limitation:** a member who *left* a center is deleted from `user_centers` and cannot be recovered, so past months are an estimate (accounts that existed by month-end and are still members), not a true historical snapshot. A real fix needs `user_centers.createdAt`/`leftAt`.
**How to apply:** any month-scoped membership metric over `user_centers` must join `users` and filter on `users.createdAt`; dedupe with a `Set(userId)`.
