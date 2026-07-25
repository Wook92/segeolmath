---
name: Tuition revenue auto-sync
description: How tuition revenue gets into the finance tab and why deletes/cancels can leave stale revenue.
---

# 교육비 매출 자동 동기화 (autoSyncAllRevenue)

재무 탭(경영>재무)의 교육비 매출은 월별 재무 레코드의 `revenueTuition`(+ `revenueTuitionDetails`)에서 읽는다. 이 값은 결제완료(paymentStatus==="paid" && paidAt) 안내로부터 `syncRevenueForYearMonth`가 **덮어쓰기**로 채우는 파생 데이터다.

## 규칙
- 교육비 안내를 삭제/취소/완료처리하면 `autoSyncAllRevenue(centerId, extraMonths)`로 매출을 재집계해야 매출이 맞게 반영된다.
- 호출은 **반드시 await** 할 것. fire-and-forget이면 클라이언트가 동기화 완료 전 재조회해 stale 매출을 본다.
- 영향받은 청구서의 **해당 월(paidAt, 없으면 createdAt 기준)을 `extraMonths`로 명시 전달**할 것. 그래야 그 청구서 월이 과거(최근 2년 밖)여도 반드시 재집계된다.

## Why
- `autoSyncAllRevenue`의 stale-clearing 루프는 **올해/작년 레코드만** 훑는다. 이 범위를 전기간으로 넓히면 과거 월의 **수동 입력 매출**(management.tsx에서 직접 편집 가능)을 auto-sync가 덮어쓰는 회귀가 생긴다. 그래서 범위는 최근 2년으로 유지하고, 정확히 영향받은 월만 `extraMonths`로 보강한다.

## How to apply
- DELETE /api/tuition-notifications/:id, PATCH .../payment-status 등 매출에 영향 주는 라우트에서 위 패턴(await + extraMonths) 적용.
- 클라이언트 mutation들은 `/api/monthly-financials` 캐시도 invalidate 해야 한다(queryClient 기본 staleTime이 Infinity라 명시 invalidation 없으면 재무 탭이 갱신 안 됨). 결제완료/취소/삭제/상태변경 mutation 모두 포함.
