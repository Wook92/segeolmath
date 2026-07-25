# Academy Management System (학원 통합 관리 시스템)

A comprehensive web application for academy management, integrating class scheduling, homework, assessments, and video content with a 7-tier user role hierarchy.

## Run & Operate

*   **Build & Run:**
    *   `npm install`
    *   `npm run build`
    *   `npm run start` (Starts both client and server)
*   **Database Migrations:** `npm run db:push` (Applies Drizzle migrations)
*   **Generate Drizzle Kit Migrations:** `npm run db:generate`
*   **Typecheck:** `npm run typecheck`
*   **Environment Variables:**
    *   `DATABASE_URL`: PostgreSQL connection string
    *   `SOLAPI_ACCESS_KEY`, `SOLAPI_SECRET_KEY`, `SOLAPI_SMS_SENDER_NUMBER`: For SMS
    *   `TOSS_PAYMENTS_SECRET_KEY`: For Toss Payments integration
    *   `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_BUCKET_NAME`: For Cloudflare R2 storage
    *   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: For Web Push Notifications
    *   `GOOGLE_GEMINI_API_KEY`: For AI report generation

## Stack

*   **Frontend:** React 18, TypeScript, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS
*   **Backend:** Express.js, TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Drizzle ORM (with drizzle-zod)
*   **Validation:** Zod
*   **Build Tool:** Vite (frontend), esbuild (server)
*   **Runtime:** Node.js

## Where things live

*   `client/`: Frontend React application
*   `server/`: Backend Express.js application
*   `shared/`: Shared types, utilities, and database schema
    *   `shared/schema.ts`: Drizzle ORM database schema (source-of-truth for Drizzle)
*   `server/schema-sql.ts`: Raw SQL schema definitions (source-of-truth for direct SQL application)
*   `client/src/components/app-sidebar.tsx`: Desktop sidebar menu configuration
*   `client/src/components/mobile-nav.tsx`: Mobile bottom navigation configuration
*   `client/src/pages/settings.tsx`: User-configurable menu ordering
*   `client/src/pages/center-registration.tsx`: Public center registration form

## Architecture decisions

*   **Seven-Tier User Role Hierarchy:** Granular, cumulative permissions for Admin, Principal, Teacher, Clinic Teacher, Student, Parent, Kiosk.
*   **Unified Database, Separate UIs:** Shares a single PostgreSQL database while providing distinct interfaces for students and staff.
*   **Dual Schema Management:** Database schema is defined in both Drizzle ORM (`shared/schema.ts`) and raw SQL (`server/schema-sql.ts`) for robust migration and existing deployment compatibility.
*   **Dynamic Menu System:** Admin-configurable hierarchical menu groups for flexible navigation.
*   **Cloudflare R2 for File Storage:** All file uploads are directed to R2 for scalability and performance, avoiding Replit's local storage.

## Product

*   **Comprehensive Academy Management:** Class scheduling, homework, assessments, video content, tuition, attendance, counseling, student performance tracking.
*   **Multi-Center Support:** Institutions can manage multiple centers with shared users.
*   **Advanced Analytics & Reporting:** Dashboard analytics, student reports (including AI-powered math wrong notes), grade trends.
*   **Integrated Communication:** SMS notifications (tuition, daily notices), web push notifications.
*   **Automated Processes:** Annual grade promotion, attendance PIN auto-generation, marketing expense auto-aggregation into finance.
*   **Flexible Payment Solutions:** Toss Payments integration with auto-recharge for SMS credits.

## User preferences

Preferred communication style: Simple, everyday language.
Preferred language: Korean (한국어) - 모든 대화는 한국어로 진행.

### File Storage Preference
- **All file uploads (images, photos, PDFs) must be stored in Cloudflare R2**
- Files should be retrieved via R2 URLs
- Do NOT use Replit's built-in object storage for file uploads
- R2 configuration is already set up with center-specific branding (logos, etc.)

### Feature Development Preference
- **When developing new features, always analyze which account types (Admin/Principal/Teacher/Clinic Teacher/Student/Parent/Kiosk) should have access**
- Implement menu visibility for appropriate roles in BOTH:
  1. `client/src/components/app-sidebar.tsx` - Desktop sidebar menu
  2. `client/src/components/mobile-nav.tsx` - Mobile bottom navigation
- For optional features visible to students, add to `studentVisibleMenuKeys` in app-sidebar.tsx
- If role access is unclear, ask the user before implementing

### Class Display Format (수업/반 표시 규칙)
- **"반" 또는 "수업"을 표시할 때는 항상 "수업명 반이름" 형식으로 표시**
- 예: "중2-2 화목S반", "고1-1 개념S반"
- 시간표 관리에서 수업 생성 시:
  - `name` 필드 = 수업명 (예: 중2-2)
  - `subject` 필드 = 반이름 (예: 화목S반, 개념S반)
- UI에서 표시할 때: `{cls.name} {cls.subject}반` 형식 사용

### Mobile Navigation Menu Structure
- **수업 관리 메뉴는 모바일 버전에서 하단 네비게이션의 "수업" 버튼으로 접근**
- 수업 관련 항목들(출결관리, 숙제관리, 수업기록, 평가관리, 클리닉, 수업영상, 대면점검 등)은 "더보기" 메뉴에 중복 표시하지 않음
- `classManagementItems` 배열에 수업 관련 메뉴 항목들이 정의되어 있음
- 동적 카테고리(수업 관리)도 모바일 더보기 메뉴에서 제외됨

## Gotchas

*   **External Production DB & Cloud:** 운영 DB와 클라우드 스토리지는 모두 외부 서비스에 연결되어 있어 Agent(Replit)에서 직접 조회/수정 불가. 운영 데이터/스키마 확인이 필요한 경우 사용자에게 직접 확인 요청. `executeSql({environment: "production"})`도 사용하지 말 것.
*   **Schema Synchronization:** Any database schema changes require updates to both `shared/schema.ts` (Drizzle) and `server/schema-sql.ts` (raw SQL).
*   **Menu Synchronization:** New menu items must be added to `client/src/components/app-sidebar.tsx`, `client/src/components/mobile-nav.tsx`, and `client/src/pages/settings.tsx`.
*   **Marketing Expense Duplication:** Ensure marketing costs are registered only once, either in campaigns or as `expenseAdvertising`, to avoid double-counting in finance reports.
*   **Attendance PIN Safety:** Deleting users or removing them from a center frees up their attendance PINs. Auto-generation logic accounts for active PINs only.

## Pointers

*   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
*   **shadcn/ui Docs:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)
*   **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
*   **React Query Docs:** [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
*   **Toss Payments API Docs:** _Populate as you build_
*   **SOLAPI SMS API Docs:** _Populate as you build_
*   **Google Gemini API Docs:** [https://ai.google.dev/docs](https://ai.google.dev/docs)