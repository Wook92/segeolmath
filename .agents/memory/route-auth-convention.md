---
name: Route auth convention
description: This app's API routes do server-side auth via body/query actorId+centerId, not middleware — don't add per-route auth inconsistently.
---

# API 라우트 인증 관례

이 코드베이스의 API 라우트(예: `/api/sms/*`, `/api/sms-templates`, `/api/sms/history` 등)는
서버측 인증 미들웨어(requireAuth/isAuthenticated 등)를 사용하지 않는다. 대신 프론트가 보내는
`actorId`(body)와 `centerId`(query/body)를 신뢰하고, 권한 판단은 프론트(app-sidebar 메뉴 노출 +
UserRole 체크)에서 수행한다.

**Why:** 신규 기능(예: 예약 문자 3개 라우트)에 대해 code_review가 "Broken Access Control"을
지적하곤 하나, 이는 앱 전반의 기존 아키텍처 패턴이다. 신규 라우트에만 서버 인증을 추가하면
프론트(인증 토큰 미전송)와 불일치가 생겨 오히려 회귀가 발생한다.

**How to apply:** 새 라우트를 추가할 때 기존 형제 라우트의 인증 유무를 먼저 확인하고 그 패턴을
따를 것. 전면적인 인증 강화는 별도 과제로 분리해 앱 전체를 한 번에 바꿔야 한다.
