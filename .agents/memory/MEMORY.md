# Project Memory Index

- [Retention Day-N analytics](retention-day-n.md) — Day1/7/30 retention is forward-looking; recent days are "측정 중" (null), not 0%.
- [Route auth convention](route-auth-convention.md) — API 라우트는 미들웨어 인증 없이 body actorId/centerId 신뢰; 신규 라우트만 인증 추가하지 말 것.
- [App route code splitting](app-route-code-splitting.md) — App.tsx pages must be React.lazy, not static imports, to keep the initial bundle small.
- [Toss + node-fetch gzip](toss-node-fetch-gzip.md) — all Toss calls disable gzip (compress:false) + retry; confirm must self-heal via status re-query on lost response.
- [Schema apply & typecheck workflow](schema-and-typecheck-workflow.md) — schema-sql.ts runs on boot (restart, not db:push); full tsc exceeds sandbox limit, use LSP diagnostics.
- [새학기 안내 현재 시간표 불러오기](semester-import-current-timetable.md) — classes/enrollments 복사 import의 멱등(시그니처/키 dedup, DB제약 없음)·센터경계·권한 결정.
- [Tuition revenue auto-sync](tuition-revenue-sync.md) — 교육비 매출은 paid 안내에서 파생; 삭제/취소 시 autoSyncAllRevenue를 await+해당월(extraMonths) 전달, 클라 /api/monthly-financials invalidate 필수.
- [교사소통 인수인계 정책](teacher-communication-handover.md) — 담당교사 변경 시 대화 승계 규칙(teacherId만 재작성, 보수적 자동이관, POST로 reconcile, 권한검증 필수).
- [클리닉↔시간표 담당교사 연동](clinic-class-teacher-sync.md) — 클리닉 regularTeacherId는 classGroup 문자열("수업명 (반이름)"/레거시 "수업명")로 정규 수업 담당교사를 따라감.
- [Toss payment reconciliation](toss-payment-reconciliation.md) — never trust the browser confirm callback; finalize server-side via webhook + periodic reconcile, idempotent compare-and-set.
- [교육비 월별 납부 상태 규칙](tuition-payment-status-masking.md) — 같은 달 안내 여러 건이면 하나라도 미결제 시 "결제대기"(pending 우선). paid 우선 금지.
- [학생 퇴원 soft delete](student-withdrawal-soft-delete.md) — 퇴원=withdrawn_at soft delete+수강 스냅샷; 목록은 기본 퇴원생 제외(includeWithdrawn 옵션); 1년 후 purge.
- [월별 재무 동결 스냅샷](monthly-finance-freeze.md) — 인건비 실시간 계산은 지난달(KST)이면 스냅샷 서빙+최초1회 동결; 현재 월은 계산+upsert, 12h 스케줄러가 보강.
- [삭제된 학생 (퇴원생) 표시](deleted-student-display.md) — 하드 삭제 학생은 exit record 자동 스냅샷으로 이름 복구해 "이름 (퇴원생)" 표시; 자동 기록은 사유 통계에서 제외.
