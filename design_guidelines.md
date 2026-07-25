# Design Guidelines: Academy Management System

## Design Approach

**Selected Approach: Design System - Material Design 3**

**Justification:**
- Utility-focused educational management platform requiring efficiency over aesthetic differentiation
- Information-dense interface with complex data structures (schedules, grades, homework tracking)
- Multi-role system (5 user levels) needing clear hierarchy and navigation patterns
- Mobile-first requirement aligns with Material's responsive foundation
- Requires established patterns for forms, tables, calendars, and data visualization

**Key Design Principles:**
1. **Role-Based Clarity**: Distinct visual separation between student and teacher/admin interfaces
2. **Information Hierarchy**: Clear data presentation for schedules, grades, and homework
3. **Efficiency First**: Minimize clicks for frequent actions (homework submission, grade entry)
4. **Progressive Disclosure**: Show complexity only when needed based on user role

---

## Typography System

**Font Family:** Noto Sans KR (Korean) + Inter (English/Numbers)
- Primary: Noto Sans KR for Korean text
- Secondary: Inter for English UI elements and numerical data

**Type Scale:**
- **Display (Headings):** 32px/28px/24px - Bold (센터명, 페이지 타이틀)
- **Body Large:** 18px - Medium (수업명, 중요 안내)
- **Body:** 16px - Regular (일반 콘텐츠, 리스트 항목)
- **Body Small:** 14px - Regular (메타데이터, 보조 정보)
- **Caption:** 12px - Regular (타임스탬프, 작은 라벨)

**Numerical Data:** Inter Medium 16-18px for scores, percentages, dates

---

## Layout System

**Spacing Units:** Tailwind units of **2, 4, 6, 8, 12, 16**
- Micro spacing: `p-2`, `gap-2` (8px) - 버튼 내부, 작은 요소 간격
- Standard spacing: `p-4`, `m-4` (16px) - 카드 패딩, 폼 요소
- Section spacing: `py-8`, `px-6` (32px/24px) - 컨테이너, 섹션 구분
- Large gaps: `gap-12`, `py-16` (48px/64px) - 주요 섹션 구분

**Grid Structure:**
- Mobile: Single column, full-width cards
- Tablet: 2-column for homework grid, 1-column for forms
- Desktop: Sidebar navigation (240px) + main content area

---

## Component Library

### Navigation & Structure
**Student/Parent Interface:**
- Bottom Tab Bar (Mobile): 홈 | 시간표 | 숙제 | 평가 | 교재
- Top App Bar: 센터 선택 드롭다운, 프로필 아이콘

**Teacher/Admin Interface:**
- Side Navigation Drawer (Desktop): Collapsible, persistent
- Top App Bar: 센터 전환, 역할 배지, 알림 아이콘
- Tabs for context switching: 수업관리 | 숙제검사 | 평가입력

### Core Components

**Schedule/Timetable:**
- Grid layout: 시간(rows) × 요일(columns)
- Card elevation: 2dp for each class block
- Multi-instructor: Tabbed interface above timetable
- Color coding: Teacher-defined pastel palette per class
- Chip badges: 수업 유형 (일반/평가)

**Homework Cards:**
- Material Card with 4dp elevation
- Structure: 날짜 | 과목명 | 완성도 표시 (circular progress indicator)
- Emoji overlay on calendar dates: 😢😞😐🙂😄
- Expandable detail: Click to reveal 숙제 내용, 제출 사진, 선생님 피드백

**Forms & Input:**
- Outlined Text Fields (Material 3 style)
- Floating labels
- Helper text for validation
- Photo upload: Drag-and-drop zone with thumbnail preview grid
- Action buttons: Filled primary (제출, 저장) / Outlined secondary (취소)

**Data Tables (Teacher/Admin):**
- Sticky header rows
- Sortable columns: 이름, 제출일, 완성도
- Row actions: Icon buttons (수정, 삭제, 대면검사 완료)
- Responsive: Stack to cards on mobile

**Calendar Component:**
- Month view with date cells
- Color-coded borders for homework completion rate
- Modal/bottom sheet for date detail (숙제 내용, 제출 상태)

**Video Display:**
- YouTube embed with 16:9 aspect ratio
- Thumbnail + title preview before click
- Material Card container with play icon overlay

**Assessment Visualization:**
- Bar chart: Student score vs. Average
- Material elevation cards for monthly data
- Navigation: "이전 달" / "다음 달" buttons
- Legend: 본인 점수 (primary color) | 평균 (neutral color)

### Role-Specific UI Elements

**Permission Badges:**
- Small chips near username: "관리자" | "원장" | "선생님" | "학생"
- Distinct background for each level

**Contextual Actions:**
- Floating Action Button (FAB): 숙제 출제 (Teacher), 수업 신청 (Student)
- Speed dial FAB for multi-action (관리자: 센터 추가, 계정 생성, 교재 등록)

---

## Specific Layouts

**Student Dashboard:**
- Hero section: 오늘의 시간표 (compact card)
- Grid: 미완료 숙제 (2-column on tablet, 1 on mobile)
- List: 최근 평가 결과 (horizontal scroll cards)

**Teacher Dashboard:**
- Stats overview: 4-column grid (오늘 수업 | 미검사 숙제 | 평가 대기 | 소속 학생)
- Quick actions: 수업별 탭 → 숙제 검사 리스트
- Calendar: 주간 뷰 with homework density heatmap

**Admin Panel:**
- Multi-level navigation: Drawer > 센터 선택 > 기능 메뉴
- Dashboard: 센터별 통계 카드 grid
- Data tables: Full-width with filters (센터, 역할, 날짜)

---

## Animations

**Minimal, purposeful motion:**
- Page transitions: Fade (100ms)
- Card interactions: Elevation change on hover (2dp → 4dp, 150ms ease)
- Modal/Dialog: Scale + fade in (200ms)
- No scroll-based animations
- Loading states: Linear progress bar (indeterminate)

---

## Images

**No hero images** - This is a utility application focused on data and functionality.

**Contextual images:**
- User profile photos: 40px circular avatars
- Homework submission photos: Grid layout, max 4 per row
- Textbook covers: 120×180px thumbnail with shadow
- Empty states: Simple illustrations (no photos needed)