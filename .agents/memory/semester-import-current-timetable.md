---
name: 새학기 안내 - 현재 시간표 불러오기
description: 운영 중 classes/enrollments를 semesterAnnouncementClasses/Recommendations로 복사하는 import 기능의 멱등/권한 결정
---

# 새학기 안내 "현재 시간표 불러오기"

직원 전용 버튼. 현재 센터의 운영 수업(classes)과 각 수업 수강생(enrollments)을
해당 새학기 안내로 복사한다(수업→semesterAnnouncementClasses, 수강생→semesterRecommendations).

## 결정 규칙
- **멱등(재실행 안전)은 in-memory dedup으로만 보장**한다. DB 고유 제약은 없다.
  - 수업 중복 판정 = 복합 시그니처 `name|subject|classLevel|teacherId|classroom|days(정렬)|startTime|endTime|schedule`.
    - **Why:** classId로 매칭하면 announcement class에는 원본 classId를 저장하지 않아 불가. 시그니처가 너무 좁으면(예: name/subject/시간만) 서로 다른 반을 병합한다 → 식별 속성을 모두 포함.
  - 추천 중복 판정 = `(studentId, announcementClassId)` 키.
- **동시성은 강하게 보장하지 않음(의도된 수용).** 동일 announcement에 동시 import 2회 시 race로 중복 가능.
  - **Why:** 운영 DB가 외부 서비스라 Agent가 unique 인덱스 등 스키마 제약을 적용/검증할 수 없음. 버튼이 직원 전용 + 진행 중 비활성이라 동시 호출 가능성 낮음. 강한 보장이 필요해지면 `semester_recommendations(announcement_class_id, student_id)` unique + on-conflict-do-nothing을 dual-schema로 추가할 것.
- **센터 경계 필수 검증.** import 라우트는 role>=TEACHER만으로 부족 — `getUserCenters(actorId)`로 `announcement.centerId` 소속을 반드시 확인(미소속 403). 다른 semester 라우트는 role만 검사하므로 mutation 추가 시 이 패턴을 따를 것.
- teacherName은 class.teacherId로 `getCenterUsers` id→name 매핑해 해석(active class는 teacherName 스냅샷이 비어있음).
