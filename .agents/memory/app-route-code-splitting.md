---
name: App route code splitting
description: client/src/App.tsx pages must stay lazy-loaded to keep initial bundle small
---

# App.tsx route code splitting

All page components in `client/src/App.tsx` are loaded via `React.lazy(() => import(...))`,
wrapped in `<Suspense>`. Only `LoginPage` and `NotFound` are eager.

**Why:** With ~60 pages statically imported, the whole app was one giant chunk, so
nothing (not even the login screen) rendered until it all downloaded/parsed. Users
reported the login screen taking a long time to appear, which got worse as features
were added. Route-based code splitting fixed it.

**How to apply:** When adding a new page/route, declare it as
`const XPage = lazy(() => import("@/pages/x"))`, never a static `import`. The page must
have a `default export` (React.lazy requires it). Do not revert lazy pages back to
static imports — it re-inflates the initial bundle.
