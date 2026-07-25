import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BookOpen, Users, Calendar, ClipboardList, FileText, Video, 
  Stethoscope, DollarSign, Settings, 
  UserCheck, Home, Building2, Info, Coffee, FileBarChart, BarChart3, Calculator
} from "lucide-react";
import { UserRole } from "@shared/schema";

interface ManualFeature {
  title: string;
  description: string;
  steps?: string[];
}

interface ManualSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  description: string;
  features: ManualFeature[];
  tips?: string[];
  lastUpdated: string;
}

type RoleType = "principal" | "teacher" | "student";

const principalSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "대시보드",
    icon: Home,
    description: "학원 현황을 한눈에 볼 수 있는 메인 화면입니다.",
    features: [
      {
        title: "월별 학생 수 통계",
        description: "연도별 월간 학생 수 변화를 차트로 확인할 수 있습니다.",
        steps: [
          "좌측 상단의 센터를 선택합니다",
          "연도를 선택하여 해당 연도의 통계를 확인합니다",
          "막대 그래프에 마우스를 올리면 정확한 수치가 표시됩니다",
          "전년도 대비 증감률이 퍼센트로 함께 표시됩니다"
        ]
      },
      {
        title: "빠른 현황 카드",
        description: "오늘의 출석, 숙제 제출률, 클리닉 현황 등을 카드 형태로 확인합니다.",
        steps: [
          "각 카드를 클릭하면 해당 상세 페이지로 이동합니다",
          "숫자가 빨간색이면 주의가 필요한 항목입니다"
        ]
      }
    ],
    tips: [
      "대시보드에서 학원 전체 현황을 한눈에 파악할 수 있습니다",
      "차트는 매일 자정에 자동으로 업데이트됩니다",
      "센터별로 필터링하여 각 센터의 현황을 개별 확인할 수 있습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "users",
    title: "사용자 관리",
    icon: Users,
    description: "학원 구성원 계정을 관리하는 페이지입니다. 선생님, 학생, 학부모 계정을 생성하고 관리합니다.",
    features: [
      {
        title: "사용자 등록",
        description: "새로운 사용자 계정을 생성합니다.",
        steps: [
          "우측 상단의 '사용자 추가' 버튼을 클릭합니다",
          "이름을 입력합니다",
          "전화번호를 입력합니다 (로그인 ID로 사용됩니다)",
          "비밀번호를 설정합니다",
          "역할(권한)을 선택합니다: 선생님, 학생, 학부모 등",
          "소속 센터를 선택합니다 (여러 센터 선택 가능)",
          "학생인 경우 학년을 선택합니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "엑셀 일괄등록",
        description: "엑셀 파일로 여러 사용자를 한번에 등록합니다. 학기 초 대량 등록에 유용합니다.",
        steps: [
          "'엑셀 일괄등록' 버튼을 클릭합니다",
          "'양식 다운로드'를 클릭하여 엑셀 템플릿을 받습니다",
          "양식에 맞게 사용자 정보를 입력합니다",
          "작성한 엑셀 파일을 업로드합니다",
          "미리보기에서 데이터를 확인합니다",
          "'등록하기' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "비밀번호 초기화",
        description: "사용자가 비밀번호를 잊어버린 경우 초기화할 수 있습니다.",
        steps: [
          "사용자 목록에서 해당 사용자를 찾습니다",
          "사용자 행의 우측 메뉴(⋮)를 클릭합니다",
          "'비밀번호 초기화'를 선택합니다",
          "새 비밀번호를 입력하고 확인합니다",
          "사용자에게 새 비밀번호를 안내합니다"
        ]
      },
      {
        title: "담임 선생님 지정",
        description: "학생에게 담임 선생님을 배정합니다. 담임 선생님은 해당 학생의 정보를 조회할 수 있습니다.",
        steps: [
          "학생 목록에서 해당 학생을 찾습니다",
          "학생 정보 수정 버튼을 클릭합니다",
          "'담임 선생님' 항목에서 선생님을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "학부모 연결",
        description: "학생 계정과 학부모 계정을 연결합니다.",
        steps: [
          "학생 정보 수정 화면으로 이동합니다",
          "'학부모' 항목에서 학부모 계정을 선택합니다",
          "한 학생에게 여러 학부모를 연결할 수 있습니다"
        ]
      },
      {
        title: "사용자 검색 및 필터",
        description: "원하는 사용자를 빠르게 찾을 수 있습니다.",
        steps: [
          "검색창에 이름 또는 전화번호를 입력합니다",
          "역할별 필터를 사용하여 선생님/학생/학부모만 표시할 수 있습니다",
          "센터별 필터로 특정 센터 소속만 볼 수 있습니다"
        ]
      }
    ],
    tips: [
      "원장은 본인보다 낮은 권한의 사용자만 관리할 수 있습니다",
      "매년 1월 1일에 학생 학년이 자동으로 올라갑니다 (초6→중1, 중3→고1)",
      "삭제된 사용자는 복구할 수 없으니 신중하게 삭제하세요",
      "전화번호가 로그인 ID이므로 중복될 수 없습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "timetable",
    title: "시간표 관리",
    icon: Calendar,
    description: "수업 일정을 관리하는 시간표 페이지입니다. 수업을 추가, 수정, 삭제할 수 있습니다.",
    features: [
      {
        title: "시간표 조회",
        description: "요일별, 시간대별 수업 일정을 확인합니다.",
        steps: [
          "상단에서 센터를 선택합니다",
          "요일 탭(월~일)을 클릭하여 해당 요일 수업을 확인합니다",
          "수업 카드를 클릭하면 상세 정보가 표시됩니다"
        ]
      },
      {
        title: "수업 추가",
        description: "새로운 수업을 등록합니다.",
        steps: [
          "우측 상단의 '수업 추가' 버튼을 클릭합니다",
          "수업명을 입력합니다",
          "담당 선생님을 선택합니다",
          "과목을 선택합니다",
          "수업 요일을 선택합니다 (복수 선택 가능)",
          "시작 시간과 종료 시간을 설정합니다",
          "교실 정보를 입력합니다 (선택사항)",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "수업 수정",
        description: "기존 수업 정보를 변경합니다.",
        steps: [
          "시간표에서 수정할 수업을 클릭합니다",
          "'수정' 버튼을 클릭합니다",
          "변경할 정보를 수정합니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "수업 삭제",
        description: "더 이상 진행하지 않는 수업을 삭제합니다.",
        steps: [
          "시간표에서 삭제할 수업을 클릭합니다",
          "'삭제' 버튼을 클릭합니다",
          "확인 메시지에서 '삭제'를 선택합니다"
        ]
      },
      {
        title: "수강생 관리",
        description: "수업에 등록된 학생을 확인하고 관리합니다.",
        steps: [
          "수업을 클릭하여 상세 정보를 엽니다",
          "'수강생' 탭에서 등록된 학생 목록을 확인합니다",
          "학생을 추가하거나 제외할 수 있습니다"
        ]
      }
    ],
    tips: [
      "수업 시간이 겹치지 않도록 주의하세요",
      "수업을 삭제하면 해당 수업의 모든 기록이 함께 삭제됩니다",
      "같은 선생님의 수업이 시간대별로 색상 구분되어 표시됩니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "student-reports",
    title: "월간 보고서",
    icon: FileBarChart,
    description: "AI 기반 월간 학생 리포트를 생성하고 관리하는 페이지입니다.",
    features: [
      {
        title: "리포트 생성",
        description: "AI가 학생의 월간 활동을 분석하여 리포트를 자동 생성합니다.",
        steps: [
          "학생을 선택합니다",
          "리포트 기간(년/월)을 선택합니다",
          "'AI 리포트 생성' 버튼을 클릭합니다",
          "AI가 출석, 숙제, 평가 데이터를 분석합니다",
          "생성된 리포트 내용을 확인합니다"
        ]
      },
      {
        title: "리포트 수정",
        description: "AI가 생성한 리포트 내용을 직접 수정할 수 있습니다.",
        steps: [
          "생성된 리포트에서 '수정' 버튼을 클릭합니다",
          "내용을 원하는 대로 수정합니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "리포트 조회",
        description: "과거에 생성한 리포트를 다시 확인합니다.",
        steps: [
          "학생과 기간을 선택합니다",
          "이전에 생성된 리포트가 있으면 자동으로 표시됩니다"
        ]
      }
    ],
    tips: [
      "리포트는 출석률, 숙제 제출률, 평가 점수 등을 종합 분석합니다",
      "AI 생성 후 내용을 검토하고 필요시 수정하세요",
      "학부모 상담 시 리포트를 활용하면 효과적입니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "study-cafe",
    title: "스터디카페",
    icon: Coffee,
    description: "스터디카페 좌석을 관리하는 페이지입니다.",
    features: [
      {
        title: "좌석 배치 관리",
        description: "스터디카페 좌석을 추가하거나 삭제합니다.",
        steps: [
          "'편집 모드' 버튼을 클릭합니다",
          "빈 공간을 클릭하여 새 좌석을 추가합니다",
          "기존 좌석을 클릭하여 삭제할 수 있습니다",
          "'저장' 버튼을 클릭하여 완료합니다"
        ]
      },
      {
        title: "고정석 배정",
        description: "직원(선생님)에게 전용 고정 좌석을 배정합니다.",
        steps: [
          "좌석을 클릭합니다",
          "'고정석 배정' 옵션을 선택합니다",
          "담당 직원(선생님)을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "예약 현황 확인",
        description: "학생들의 좌석 예약 현황을 실시간으로 확인합니다.",
        steps: [
          "좌석 배치도에서 색상으로 상태를 구분합니다",
          "초록색: 이용 가능, 빨간색: 사용 중, 회색: 고정석",
          "좌석을 클릭하면 예약자 정보가 표시됩니다"
        ]
      },
      {
        title: "예약 강제 종료",
        description: "필요한 경우 학생의 예약을 관리자가 종료할 수 있습니다.",
        steps: [
          "사용 중인 좌석을 클릭합니다",
          "'예약 종료' 버튼을 클릭합니다",
          "확인 메시지에서 '종료'를 선택합니다"
        ]
      }
    ],
    tips: [
      "센터별로 스터디카페 활성화/비활성화를 설정할 수 있습니다",
      "고정석은 해당 직원 전용으로 예약되어 학생이 사용할 수 없습니다",
      "피크 시간대에는 예약 현황을 자주 확인하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "tuition",
    title: "교육비",
    icon: DollarSign,
    description: "교육비 안내문을 작성하고 학부모/학생에게 발송하는 페이지입니다.",
    features: [
      {
        title: "교육비 안내 작성",
        description: "학생별 교육비 안내문을 작성합니다.",
        steps: [
          "학생을 선택합니다",
          "'새 안내문 작성' 버튼을 클릭합니다",
          "안내문 제목을 입력합니다",
          "교육비 내역을 입력합니다",
          "필요시 이미지를 첨부합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "SMS 발송",
        description: "작성한 교육비 안내를 SMS로 발송합니다.",
        steps: [
          "발송할 안내문을 선택합니다",
          "'SMS 발송' 버튼을 클릭합니다",
          "발송 대상(학생/학부모)을 확인합니다",
          "'발송' 버튼을 클릭합니다"
        ]
      },
      {
        title: "비밀번호 설정",
        description: "교육비 조회용 비밀번호를 설정합니다.",
        steps: [
          "'비밀번호 설정' 버튼을 클릭합니다",
          "새 비밀번호를 입력합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "안내문 이력 조회",
        description: "과거에 발송한 교육비 안내문을 확인합니다.",
        steps: [
          "학생을 선택합니다",
          "이전 안내문 목록이 날짜순으로 표시됩니다",
          "안내문을 클릭하면 내용을 확인할 수 있습니다"
        ]
      }
    ],
    tips: [
      "교육비 정보는 비밀번호로 보호됩니다",
      "SMS 발송에는 SOLAPI 연동이 필요합니다 (설정에서 API 키 등록)",
      "월별로 안내문을 발송하면 관리가 편리합니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "attendance",
    title: "출결 관리",
    icon: UserCheck,
    description: "학생 출석을 관리하고 학부모에게 알림을 발송하는 페이지입니다.",
    features: [
      {
        title: "출석 현황 조회",
        description: "날짜별, 수업별 학생 출석 현황을 확인합니다.",
        steps: [
          "조회할 날짜를 선택합니다",
          "수업별로 출석한 학생 목록이 표시됩니다",
          "출석/지각/결석 상태가 색상으로 구분됩니다"
        ]
      },
      {
        title: "수동 출석 처리",
        description: "키오스크 외에 수동으로 출석을 처리합니다.",
        steps: [
          "해당 학생을 찾습니다",
          "'출석 처리' 버튼을 클릭합니다",
          "출석 시간과 상태(출석/지각)를 선택합니다"
        ]
      },
      {
        title: "출석 PIN 관리",
        description: "학생별 키오스크 출석용 4자리 PIN을 관리합니다.",
        steps: [
          "'PIN 관리' 탭으로 이동합니다",
          "학생 목록에서 PIN을 확인하거나 수정합니다",
          "PIN을 변경하려면 새 4자리 숫자를 입력합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "메시지 템플릿 관리",
        description: "출석 알림 SMS 템플릿을 설정합니다.",
        steps: [
          "'메시지 템플릿' 탭으로 이동합니다",
          "출석 시 발송할 메시지 내용을 작성합니다",
          "{학원명}, {학생명}, {날짜} 등 변수를 사용할 수 있습니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "출석 통계",
        description: "기간별 출석률 통계를 확인합니다.",
        steps: [
          "'통계' 탭으로 이동합니다",
          "조회 기간을 선택합니다",
          "학생별, 수업별 출석률이 표시됩니다"
        ]
      }
    ],
    tips: [
      "학생이 키오스크에서 PIN을 입력하면 자동으로 출석 처리됩니다",
      "출석 시 등록된 학부모 전화번호로 SMS가 자동 발송됩니다",
      "PIN은 학생이 기억하기 쉬운 숫자로 설정하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "textbooks",
    title: "교재 영상",
    icon: BookOpen,
    description: "교재 해설 및 풀이 영상을 관리하는 페이지입니다.",
    features: [
      {
        title: "교재 등록",
        description: "새로운 교재를 등록합니다.",
        steps: [
          "'교재 추가' 버튼을 클릭합니다",
          "교재명을 입력합니다",
          "과목을 선택합니다",
          "학년을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "풀이 영상 업로드",
        description: "교재별 풀이 영상을 업로드합니다.",
        steps: [
          "교재를 선택합니다",
          "'영상 추가' 버튼을 클릭합니다",
          "영상 제목(단원/페이지 등)을 입력합니다",
          "YouTube URL을 입력합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "영상 순서 정렬",
        description: "풀이 영상의 순서를 조정합니다.",
        steps: [
          "교재를 선택합니다",
          "'순서 편집' 버튼을 클릭합니다",
          "드래그 앤 드롭으로 순서를 변경합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      }
    ],
    tips: [
      "YouTube 영상 URL만 지원됩니다",
      "학년과 과목으로 교재를 구분하면 학생이 찾기 쉽습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "settings",
    title: "설정",
    icon: Settings,
    description: "개인 및 센터 설정을 관리하는 페이지입니다.",
    features: [
      {
        title: "비밀번호 변경",
        description: "본인의 로그인 비밀번호를 변경합니다.",
        steps: [
          "'비밀번호 변경' 섹션으로 이동합니다",
          "현재 비밀번호를 입력합니다",
          "새 비밀번호를 입력합니다",
          "새 비밀번호를 다시 한번 확인 입력합니다",
          "'변경' 버튼을 클릭합니다"
        ]
      },
      {
        title: "테마 설정",
        description: "라이트/다크 모드를 선택합니다.",
        steps: [
          "우측 상단의 테마 아이콘을 클릭합니다",
          "라이트/다크/시스템 중 선택합니다"
        ]
      },
      {
        title: "센터 설정",
        description: "센터별 기능 활성화를 관리합니다.",
        steps: [
          "센터를 선택합니다",
          "스터디카페 활성화 여부를 설정합니다",
          "SOLAPI SMS 연동 정보를 입력합니다"
        ]
      }
    ],
    tips: [
      "비밀번호는 8자 이상 권장됩니다",
      "SMS 연동을 위해 SOLAPI API 키와 발신번호가 필요합니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "math-wrong-notes",
    title: "수학 오답노트",
    icon: Calculator,
    description: "AI가 교재 이미지에서 문제를 자동 감지하고, 오답노트를 생성하여 학생에게 할당하는 기능입니다. (1페이지당 90원 크레딧 차감)",
    features: [
      {
        title: "문제집 등록",
        description: "새 문제집을 등록하고 PDF/이미지를 업로드합니다.",
        steps: [
          "수학 오답노트 메뉴로 이동합니다",
          "'문제집 등록' 버튼을 클릭합니다",
          "문제집 이름을 입력하고 등록합니다",
          "문제집 카드를 클릭하여 편집 화면으로 들어갑니다"
        ]
      },
      {
        title: "페이지 업로드 및 AI 감지",
        description: "교재 페이지를 업로드하면 AI가 자동으로 문제 영역을 감지합니다.",
        steps: [
          "'업로드' 버튼을 클릭합니다",
          "PDF 또는 이미지 파일을 선택합니다",
          "페이지 수를 확인하고 업로드합니다 (크레딧 차감)",
          "AI가 자동으로 문제 영역을 파란색 박스로 표시합니다",
          "각 박스는 좌측 상단에 쪽수-문제번호가 표시됩니다",
          "박스를 드래그하여 새로 추가하거나, 모서리/변의 동그라미를 드래그하여 크기 조정할 수 있습니다",
          "× 버튼으로 잘못 감지된 박스를 삭제할 수 있습니다",
          "변경사항은 자동 저장됩니다"
        ]
      },
      {
        title: "오답노트 생성",
        description: "체크한 문제들로 오답노트를 생성합니다.",
        steps: [
          "각 문제 박스의 체크박스를 클릭하여 선택합니다",
          "하단의 '오답노트 생성 (N문제)' 버튼을 클릭합니다",
          "오답노트 제목을 입력하고 생성합니다"
        ]
      },
      {
        title: "오답노트 학생 할당",
        description: "생성된 오답노트를 학생에게 할당합니다.",
        steps: [
          "오답노트 목록에서 오답노트를 클릭합니다",
          "'학생 할당' 버튼을 클릭합니다",
          "선생님을 선택하면 해당 선생님의 반 목록이 표시됩니다 (원장/관리자)",
          "반을 선택하면 해당 반 학생만 필터됩니다",
          "학년 필터나 이름 검색으로 학생을 찾습니다",
          "학생을 체크하고 '할당' 버튼을 클릭합니다"
        ]
      },
      {
        title: "인쇄/PDF 다운로드",
        description: "오답노트를 인쇄하거나 PDF로 저장합니다.",
        steps: [
          "오답노트 상세 화면에서 '인쇄' 또는 'PDF 다운로드' 버튼을 클릭합니다",
          "2열 레이아웃으로 쪽수-번호 순서대로 정렬됩니다",
          "인쇄 대화상자에서 프린터 또는 'PDF로 저장'을 선택합니다"
        ]
      }
    ],
    tips: [
      "AI 감지 비용은 1페이지당 90원입니다 (충전 잔액에서 차감)",
      "PDF 파일은 자동으로 페이지별 이미지로 변환됩니다",
      "AI가 감지한 쪽수는 교재 하단의 페이지 번호를 읽어 자동 설정됩니다",
      "잔액이 부족하면 '잔액충전' 메뉴에서 충전할 수 있습니다",
      "박스를 수정하면 자동 저장되므로 별도 저장 버튼을 누를 필요가 없습니다"
    ],
    lastUpdated: "2026-03"
  }
];

const teacherSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "대시보드",
    icon: Home,
    description: "담당 학생 현황과 오늘의 일정을 확인하는 메인 화면입니다.",
    features: [
      {
        title: "담당 학생 현황",
        description: "담임으로 배정된 학생들의 현황을 확인합니다.",
        steps: [
          "대시보드에서 담당 학생 수를 확인합니다",
          "카드를 클릭하면 학생 목록으로 이동합니다"
        ]
      },
      {
        title: "오늘의 수업",
        description: "오늘 진행할 수업 목록을 확인합니다.",
        steps: [
          "대시보드에서 오늘의 수업 카드를 확인합니다",
          "수업을 클릭하면 상세 정보로 이동합니다"
        ]
      },
      {
        title: "할 일 확인",
        description: "처리해야 할 숙제 확인, 클리닉 기록 등을 확인합니다."
      }
    ],
    tips: [
      "대시보드를 자주 확인하여 놓치는 업무가 없도록 하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "timetable",
    title: "시간표",
    icon: Calendar,
    description: "수업 일정을 확인하고 관리하는 페이지입니다.",
    features: [
      {
        title: "시간표 조회",
        description: "요일별, 시간대별 수업 일정을 확인합니다.",
        steps: [
          "상단에서 센터를 선택합니다",
          "요일 탭(월~일)을 클릭하여 해당 요일 수업을 확인합니다",
          "수업 카드를 클릭하면 상세 정보가 표시됩니다",
          "내 수업은 강조 표시됩니다"
        ]
      },
      {
        title: "수업 추가",
        description: "새로운 수업을 등록합니다.",
        steps: [
          "'수업 추가' 버튼을 클릭합니다",
          "수업명, 과목, 요일, 시간을 입력합니다",
          "교실 정보를 입력합니다 (선택)",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "수업 수정/삭제",
        description: "담당 수업의 정보를 수정하거나 삭제합니다.",
        steps: [
          "수정할 수업을 클릭합니다",
          "'수정' 또는 '삭제' 버튼을 클릭합니다",
          "변경 사항을 저장합니다"
        ]
      },
      {
        title: "수강생 확인",
        description: "수업에 등록된 학생 목록을 확인합니다.",
        steps: [
          "수업을 클릭하여 상세 정보를 엽니다",
          "'수강생' 탭에서 등록된 학생을 확인합니다"
        ]
      }
    ],
    tips: [
      "내 수업은 다른 색상으로 강조됩니다",
      "수업 시간이 겹치지 않도록 확인하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "homework",
    title: "숙제 관리",
    icon: ClipboardList,
    description: "숙제를 출제하고 학생들의 제출 현황을 관리하는 페이지입니다.",
    features: [
      {
        title: "숙제 출제",
        description: "학생들에게 새로운 숙제를 출제합니다.",
        steps: [
          "'숙제 추가' 버튼을 클릭합니다",
          "숙제 제목을 입력합니다",
          "상세 내용을 입력합니다",
          "마감일을 선택합니다",
          "대상 수업 또는 학생을 선택합니다",
          "'저장'을 클릭하여 완료합니다"
        ]
      },
      {
        title: "제출 현황 확인",
        description: "학생별 숙제 제출 현황을 확인합니다.",
        steps: [
          "숙제 목록에서 확인할 숙제를 클릭합니다",
          "제출/미제출 학생 목록이 표시됩니다",
          "제출 시간도 함께 확인할 수 있습니다"
        ]
      },
      {
        title: "숙제 수정/삭제",
        description: "출제한 숙제를 수정하거나 삭제합니다.",
        steps: [
          "수정할 숙제를 선택합니다",
          "'수정' 또는 '삭제' 버튼을 클릭합니다",
          "변경 사항을 저장합니다"
        ]
      },
      {
        title: "마감일 연장",
        description: "숙제의 마감일을 연장합니다.",
        steps: [
          "숙제를 선택합니다",
          "'수정' 버튼을 클릭합니다",
          "마감일을 새로운 날짜로 변경합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "마감일이 지난 숙제는 빨간색으로 표시됩니다",
      "숙제 설명은 구체적으로 작성하면 학생이 이해하기 쉽습니다",
      "정기적으로 제출 현황을 확인하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "class-notes",
    title: "수업 기록",
    icon: FileText,
    description: "수업 내용과 학생별 특이사항을 기록하는 페이지입니다.",
    features: [
      {
        title: "공통 수업일지",
        description: "해당 수업의 전체 진행 내용을 기록합니다.",
        steps: [
          "주차를 선택합니다",
          "수업을 선택합니다",
          "진도, 수업 내용 등을 입력합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "학생별 특이사항",
        description: "개별 학생에 대한 메모와 피드백을 기록합니다.",
        steps: [
          "학생 이름 옆의 '메모' 버튼을 클릭합니다",
          "해당 학생의 수업 태도, 이해도 등을 기록합니다",
          "칭찬할 점, 개선할 점 등을 자세히 기록합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "과거 기록 조회",
        description: "이전 주차의 수업일지를 확인합니다.",
        steps: [
          "주차 선택에서 원하는 주를 선택합니다",
          "해당 주의 수업일지가 표시됩니다"
        ]
      }
    ],
    tips: [
      "수업일지는 주차별로 자동 정리됩니다",
      "학생별 기록은 월간 리포트 생성 시 참고됩니다",
      "구체적으로 기록할수록 학부모 상담 시 유용합니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "assessments",
    title: "평가 관리",
    icon: BarChart3,
    description: "시험 및 테스트를 관리하고 점수를 입력하는 페이지입니다.",
    features: [
      {
        title: "평가 생성",
        description: "새로운 시험이나 테스트를 생성합니다.",
        steps: [
          "'평가 추가' 버튼을 클릭합니다",
          "평가명을 입력합니다 (예: 3월 월말평가)",
          "평가 유형을 선택합니다",
          "만점을 입력합니다",
          "대상 학생 또는 수업을 선택합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "점수 입력",
        description: "학생별 점수를 입력합니다.",
        steps: [
          "점수를 입력할 평가를 클릭합니다",
          "학생 목록이 표시됩니다",
          "각 학생의 점수를 입력합니다",
          "'저장' 버튼을 클릭합니다"
        ]
      },
      {
        title: "점수 수정",
        description: "입력한 점수를 수정합니다.",
        steps: [
          "평가를 선택합니다",
          "수정할 학생의 점수를 변경합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "성적 통계",
        description: "평가의 평균, 최고점, 최저점 등 통계를 확인합니다.",
        steps: [
          "평가를 선택합니다",
          "'통계' 탭에서 성적 분포를 확인합니다"
        ]
      }
    ],
    tips: [
      "점수 입력 후 반드시 저장 버튼을 클릭하세요",
      "평가별로 평균 점수가 자동 계산됩니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "clinic",
    title: "클리닉",
    icon: Stethoscope,
    description: "보충 수업이 필요한 학생을 관리하고 클리닉 진행 상황을 기록하는 페이지입니다.",
    features: [
      {
        title: "클리닉 학생 등록",
        description: "클리닉 대상 학생을 등록합니다.",
        steps: [
          "'학생 추가' 버튼을 클릭합니다",
          "학생을 검색하여 선택합니다",
          "클리닉 유형을 선택합니다",
          "담당 선생님을 지정합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "주차별 클리닉 기록",
        description: "매주 클리닉 진행 상황과 피드백을 기록합니다.",
        steps: [
          "학생을 선택합니다",
          "해당 주차를 선택합니다",
          "클리닉 내용을 상세히 기록합니다",
          "학생에게 줄 피드백을 작성합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "클리닉 자료 관리",
        description: "클리닉에 사용할 자료를 업로드하고 관리합니다.",
        steps: [
          "'자료' 탭으로 이동합니다",
          "'파일 업로드' 버튼을 클릭합니다",
          "상시 자료 또는 임시 자료를 선택합니다",
          "파일을 선택하여 업로드합니다"
        ]
      },
      {
        title: "클리닉 종료",
        description: "클리닉이 완료된 학생을 종료 처리합니다.",
        steps: [
          "학생을 선택합니다",
          "'클리닉 종료' 버튼을 클릭합니다",
          "종료 사유를 입력합니다"
        ]
      }
    ],
    tips: [
      "임시 자료는 14일 후 자동 삭제됩니다",
      "상시 자료는 영구 보관되므로 중요한 자료는 상시로 저장하세요",
      "주차별로 꾸준히 기록하면 학생의 발전 과정을 추적할 수 있습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "videos",
    title: "수업 영상",
    icon: Video,
    description: "학습 영상을 업로드하고 관리하는 페이지입니다.",
    features: [
      {
        title: "영상 업로드",
        description: "새로운 학습 영상을 등록합니다.",
        steps: [
          "'영상 추가' 버튼을 클릭합니다",
          "영상 제목을 입력합니다",
          "영상 설명을 입력합니다",
          "YouTube URL을 입력합니다",
          "카테고리를 선택합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "영상 수정/삭제",
        description: "등록된 영상 정보를 수정하거나 삭제합니다.",
        steps: [
          "수정할 영상을 선택합니다",
          "'수정' 또는 '삭제' 버튼을 클릭합니다",
          "변경 사항을 저장합니다"
        ]
      },
      {
        title: "카테고리 관리",
        description: "영상 카테고리를 추가하거나 수정합니다.",
        steps: [
          "'카테고리 관리' 버튼을 클릭합니다",
          "새 카테고리를 추가하거나 기존 카테고리를 수정합니다"
        ]
      }
    ],
    tips: [
      "YouTube에 영상을 먼저 업로드한 후 URL을 등록하세요",
      "카테고리로 구분하면 학생이 원하는 영상을 찾기 쉽습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "student-reports",
    title: "월간 보고서",
    icon: FileBarChart,
    description: "담당 학생의 월간 리포트를 생성하고 관리하는 페이지입니다.",
    features: [
      {
        title: "리포트 생성",
        description: "AI가 학생의 월간 활동을 분석하여 리포트를 생성합니다.",
        steps: [
          "담당 학생을 선택합니다",
          "리포트 기간(년/월)을 선택합니다",
          "'AI 리포트 생성' 버튼을 클릭합니다",
          "생성된 리포트를 확인하고 필요시 수정합니다"
        ]
      },
      {
        title: "리포트 수정",
        description: "AI가 생성한 내용을 직접 수정합니다.",
        steps: [
          "리포트에서 '수정' 버튼을 클릭합니다",
          "내용을 수정합니다",
          "'저장'을 클릭합니다"
        ]
      }
    ],
    tips: [
      "담임 선생님은 본인 담당 학생의 리포트만 볼 수 있습니다",
      "AI 생성 후 내용을 검토하고 필요시 수정하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "users",
    title: "학생",
    icon: Users,
    description: "담당 학생 정보를 조회하는 페이지입니다.",
    features: [
      {
        title: "학생 목록 조회",
        description: "담임으로 배정된 학생 목록을 확인합니다.",
        steps: [
          "학생 탭으로 이동합니다",
          "담임으로 배정된 학생 목록이 표시됩니다"
        ]
      },
      {
        title: "학생 정보 확인",
        description: "학생의 상세 정보를 확인합니다.",
        steps: [
          "학생을 클릭합니다",
          "연락처, 학년, 수강 수업 등 정보가 표시됩니다"
        ]
      },
      {
        title: "학부모 연락처 확인",
        description: "학생의 학부모 연락처를 확인합니다.",
        steps: [
          "학생 상세 정보에서 학부모 정보를 확인합니다"
        ]
      }
    ],
    tips: [
      "선생님은 담임으로 배정된 학생만 조회할 수 있습니다",
      "학부모 상담 전 연락처를 미리 확인하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "study-cafe",
    title: "스터디카페",
    icon: Coffee,
    description: "스터디카페 좌석 현황을 확인하는 페이지입니다.",
    features: [
      {
        title: "좌석 현황 확인",
        description: "현재 좌석 이용 현황을 실시간으로 확인합니다.",
        steps: [
          "좌석 배치도에서 색상으로 상태를 구분합니다",
          "초록색: 이용 가능, 빨간색: 사용 중"
        ]
      },
      {
        title: "예약 현황 확인",
        description: "학생들의 좌석 예약 현황을 확인합니다.",
        steps: [
          "사용 중인 좌석을 클릭합니다",
          "예약자 정보와 이용 시간이 표시됩니다"
        ]
      }
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "textbooks",
    title: "교재 영상",
    icon: BookOpen,
    description: "교재 해설 및 풀이 영상을 관리하는 페이지입니다.",
    features: [
      {
        title: "풀이 영상 업로드",
        description: "교재별 풀이 영상을 업로드합니다.",
        steps: [
          "교재를 선택합니다",
          "'영상 추가' 버튼을 클릭합니다",
          "영상 제목과 YouTube URL을 입력합니다",
          "'저장'을 클릭합니다"
        ]
      },
      {
        title: "영상 시청",
        description: "등록된 풀이 영상을 시청합니다.",
        steps: [
          "교재를 선택합니다",
          "원하는 영상을 클릭하여 시청합니다"
        ]
      }
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "math-wrong-notes",
    title: "수학 오답노트",
    icon: Calculator,
    description: "AI가 교재 이미지에서 문제를 자동 감지하고, 오답노트를 생성하여 학생에게 할당하는 기능입니다.",
    features: [
      {
        title: "문제집 등록 및 업로드",
        description: "문제집을 등록하고 교재 페이지를 업로드합니다.",
        steps: [
          "수학 오답노트 메뉴로 이동합니다",
          "'문제집 등록' 버튼을 클릭하고 이름을 입력합니다",
          "문제집 카드를 클릭하여 편집 화면으로 들어갑니다",
          "'업로드' 버튼으로 PDF 또는 이미지 파일을 업로드합니다",
          "AI가 자동으로 문제 영역을 파란색 박스로 표시합니다"
        ]
      },
      {
        title: "박스 편집",
        description: "AI가 감지한 문제 박스를 수정합니다.",
        steps: [
          "박스 모서리/변의 동그라미를 드래그하여 크기를 조정합니다",
          "이미지 위를 드래그하여 새 박스를 추가합니다",
          "× 버튼으로 잘못된 박스를 삭제합니다",
          "좌측 상단의 쪽수-번호를 클릭하여 수정합니다",
          "변경사항은 자동 저장됩니다"
        ]
      },
      {
        title: "오답노트 생성 및 학생 할당",
        description: "체크한 문제들로 오답노트를 만들어 학생에게 할당합니다.",
        steps: [
          "문제 박스의 체크박스를 클릭하여 선택합니다",
          "'오답노트 생성' 버튼을 클릭하고 제목을 입력합니다",
          "오답노트 목록에서 클릭하여 상세 화면으로 이동합니다",
          "'학생 할당' 버튼을 클릭합니다",
          "반을 선택하면 해당 반 학생만 필터됩니다",
          "학생을 체크하고 '할당'을 클릭합니다"
        ]
      },
      {
        title: "인쇄/PDF",
        description: "오답노트를 인쇄하거나 PDF로 저장합니다.",
        steps: [
          "오답노트 상세에서 '인쇄' 또는 'PDF 다운로드' 버튼을 클릭합니다",
          "2열 레이아웃으로 자동 정렬되어 출력됩니다"
        ]
      }
    ],
    tips: [
      "AI 감지 비용은 1페이지당 90원입니다",
      "박스 수정은 자동 저장되므로 별도 저장이 필요 없습니다",
      "PDF 파일은 자동으로 페이지별 이미지로 변환됩니다"
    ],
    lastUpdated: "2026-03"
  }
];

const studentSections: ManualSection[] = [
  {
    id: "my-timetable",
    title: "나의 시간표",
    icon: Calendar,
    description: "내가 수강하는 수업 일정을 확인하는 페이지입니다.",
    features: [
      {
        title: "내 수업 확인",
        description: "요일별로 내가 수강하는 수업을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭합니다",
          "해당 요일에 수강 중인 수업이 표시됩니다",
          "수업 카드에서 시간, 교실, 선생님을 확인할 수 있습니다"
        ]
      },
      {
        title: "수업 상세 정보",
        description: "수업의 상세 정보를 확인합니다.",
        steps: [
          "수업 카드를 클릭합니다",
          "수업명, 선생님, 시간, 교실 정보가 표시됩니다"
        ]
      },
      {
        title: "수강 취소",
        description: "수강 중인 수업을 취소합니다.",
        steps: [
          "취소할 수업을 클릭합니다",
          "'수강 취소' 버튼을 클릭합니다",
          "확인 메시지에서 '취소'를 선택합니다"
        ]
      }
    ],
    tips: [
      "수업 시작 전에 미리 교실을 확인하세요",
      "수강 취소 시 다시 신청해야 합니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "timetable",
    title: "학원 시간표",
    icon: Calendar,
    description: "학원 전체 시간표를 확인하고 수강 신청하는 페이지입니다.",
    features: [
      {
        title: "전체 시간표 조회",
        description: "학원의 모든 수업 일정을 확인합니다.",
        steps: [
          "요일 탭(월~일)을 클릭합니다",
          "해당 요일의 모든 수업이 시간대별로 표시됩니다",
          "수업 카드에서 수업명, 선생님, 시간을 확인할 수 있습니다"
        ]
      },
      {
        title: "수강 신청",
        description: "원하는 수업에 수강 신청을 합니다.",
        steps: [
          "수강하고 싶은 수업을 클릭합니다",
          "수업 상세 정보를 확인합니다",
          "'수강 신청' 버튼을 클릭합니다",
          "신청이 완료되면 '나의 시간표'에 추가됩니다"
        ]
      },
      {
        title: "수강 중인 수업 확인",
        description: "이미 수강 중인 수업은 표시가 다릅니다.",
        steps: [
          "수강 중인 수업은 '수강 중' 배지가 표시됩니다",
          "같은 시간대에 다른 수업이 있으면 신청할 수 없습니다"
        ]
      }
    ],
    tips: [
      "시간이 겹치는 수업은 신청할 수 없습니다",
      "수강 신청 후 '나의 시간표'에서 확인하세요",
      "수업 정원이 있는 경우 조기에 마감될 수 있습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "homework",
    title: "숙제",
    icon: ClipboardList,
    description: "선생님이 출제한 숙제를 확인하고 제출하는 페이지입니다.",
    features: [
      {
        title: "숙제 목록 확인",
        description: "나에게 배정된 숙제 목록을 확인합니다.",
        steps: [
          "숙제 페이지로 이동합니다",
          "미제출 숙제가 상단에 표시됩니다",
          "마감일 순으로 정렬되어 있습니다"
        ]
      },
      {
        title: "숙제 상세 확인",
        description: "숙제의 상세 내용을 확인합니다.",
        steps: [
          "확인할 숙제를 클릭합니다",
          "숙제 내용, 마감일, 출제 선생님이 표시됩니다"
        ]
      },
      {
        title: "숙제 제출",
        description: "숙제를 완료하고 제출 처리합니다.",
        steps: [
          "완료한 숙제를 클릭합니다",
          "'제출' 버튼을 클릭합니다",
          "제출 완료 메시지가 표시됩니다"
        ]
      },
      {
        title: "제출 이력 확인",
        description: "과거에 제출한 숙제를 확인합니다.",
        steps: [
          "'제출 완료' 탭을 클릭합니다",
          "이전에 제출한 숙제 목록이 표시됩니다"
        ]
      }
    ],
    tips: [
      "마감일이 지난 숙제는 빨간색으로 표시됩니다",
      "마감일 전에 미리미리 숙제를 완료하세요",
      "숙제를 완료했으면 반드시 제출 버튼을 눌러주세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "assessments",
    title: "평가",
    icon: BarChart3,
    description: "나의 시험 및 테스트 결과를 확인하는 페이지입니다.",
    features: [
      {
        title: "성적 확인",
        description: "나의 평가 점수를 확인합니다.",
        steps: [
          "평가 페이지로 이동합니다",
          "평가 목록에서 확인하고 싶은 평가를 선택합니다",
          "내 점수, 만점, 평균 점수가 표시됩니다"
        ]
      },
      {
        title: "성적 추이 확인",
        description: "시간에 따른 성적 변화를 확인합니다.",
        steps: [
          "과목별로 성적 추이를 그래프로 확인할 수 있습니다"
        ]
      }
    ],
    tips: [
      "평가 결과가 나오면 알림이 표시됩니다",
      "성적이 낮은 부분은 클리닉 수업으로 보충할 수 있습니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "study-cafe",
    title: "스터디카페",
    icon: Coffee,
    description: "스터디카페 좌석을 예약하고 이용하는 페이지입니다.",
    features: [
      {
        title: "좌석 현황 확인",
        description: "현재 이용 가능한 좌석을 확인합니다.",
        steps: [
          "스터디카페 페이지로 이동합니다",
          "좌석 배치도가 표시됩니다",
          "초록색: 이용 가능, 빨간색: 사용 중, 회색: 고정석(사용 불가)"
        ]
      },
      {
        title: "좌석 예약",
        description: "원하는 좌석을 예약합니다.",
        steps: [
          "이용 가능한(초록색) 좌석을 클릭합니다",
          "이용 시간을 선택합니다 (최대 2시간)",
          "'예약' 버튼을 클릭합니다",
          "예약 완료 메시지가 표시됩니다"
        ]
      },
      {
        title: "예약 취소",
        description: "예약한 좌석을 취소합니다.",
        steps: [
          "내가 예약한 좌석을 클릭합니다",
          "'예약 취소' 버튼을 클릭합니다",
          "확인 메시지에서 '취소'를 선택합니다"
        ]
      },
      {
        title: "이용 시간 확인",
        description: "남은 이용 시간을 확인합니다.",
        steps: [
          "내 좌석을 클릭하면 남은 시간이 표시됩니다"
        ]
      }
    ],
    tips: [
      "학생은 최대 2시간까지 예약할 수 있습니다",
      "이용 시간이 지나면 자동으로 좌석이 반납됩니다",
      "회색 좌석은 선생님 전용 고정석입니다"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "videos",
    title: "수업 영상",
    icon: Video,
    description: "선생님이 올린 학습 영상을 시청하는 페이지입니다.",
    features: [
      {
        title: "영상 목록 확인",
        description: "등록된 학습 영상 목록을 확인합니다.",
        steps: [
          "수업 영상 페이지로 이동합니다",
          "카테고리별로 영상이 정리되어 있습니다",
          "원하는 카테고리를 선택합니다"
        ]
      },
      {
        title: "영상 시청",
        description: "원하는 영상을 시청합니다.",
        steps: [
          "시청할 영상을 클릭합니다",
          "영상 플레이어가 열립니다",
          "재생 버튼을 클릭하여 시청합니다"
        ]
      },
      {
        title: "영상 검색",
        description: "원하는 영상을 검색합니다.",
        steps: [
          "검색창에 키워드를 입력합니다",
          "관련 영상이 검색 결과로 표시됩니다"
        ]
      }
    ],
    tips: [
      "수업 복습이나 예습에 활용하세요",
      "이해가 안 되는 부분은 반복 시청하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "textbooks",
    title: "교재 영상",
    icon: BookOpen,
    description: "교재 해설 및 풀이 영상을 시청하는 페이지입니다.",
    features: [
      {
        title: "교재 선택",
        description: "보고 싶은 교재를 선택합니다.",
        steps: [
          "교재 영상 페이지로 이동합니다",
          "교재 목록에서 내가 사용하는 교재를 찾습니다",
          "과목과 학년으로 필터링할 수 있습니다"
        ]
      },
      {
        title: "풀이 영상 시청",
        description: "교재별 풀이 영상을 시청합니다.",
        steps: [
          "교재를 선택합니다",
          "해당 교재의 풀이 영상 목록이 표시됩니다",
          "원하는 단원/페이지의 영상을 클릭합니다",
          "영상을 시청합니다"
        ]
      }
    ],
    tips: [
      "교재 문제를 먼저 풀어본 후 풀이 영상을 확인하세요",
      "이해가 안 되는 문제는 영상을 반복 시청하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "tuition",
    title: "교육비",
    icon: DollarSign,
    description: "나의 교육비 내역을 확인하는 페이지입니다.",
    features: [
      {
        title: "교육비 확인",
        description: "이번 달 교육비 안내를 확인합니다.",
        steps: [
          "교육비 페이지로 이동합니다",
          "비밀번호를 입력합니다",
          "교육비 내역이 표시됩니다"
        ]
      },
      {
        title: "과거 내역 확인",
        description: "이전 달의 교육비 안내를 확인합니다.",
        steps: [
          "교육비 페이지에서 월을 선택합니다",
          "해당 월의 교육비 내역이 표시됩니다"
        ]
      }
    ],
    tips: [
      "교육비 정보는 비밀번호로 보호됩니다",
      "비밀번호를 잊은 경우 선생님께 문의하세요"
    ],
    lastUpdated: "2025-01"
  },
  {
    id: "math-wrong-notes",
    title: "수학 오답노트",
    icon: Calculator,
    description: "선생님이 만들어준 오답노트를 확인하고 풀어보는 기능입니다.",
    features: [
      {
        title: "오답노트 확인",
        description: "할당받은 오답노트를 확인합니다.",
        steps: [
          "수학 오답노트 메뉴로 이동합니다",
          "할당된 오답노트 목록이 표시됩니다",
          "오답노트를 클릭하면 문제들이 표시됩니다"
        ]
      },
      {
        title: "인쇄/PDF",
        description: "오답노트를 인쇄하거나 PDF로 저장합니다.",
        steps: [
          "오답노트 상세 화면에서 '인쇄' 또는 'PDF 다운로드' 버튼을 클릭합니다",
          "2열 레이아웃으로 문제가 정렬되어 출력됩니다"
        ]
      }
    ],
    tips: [
      "오답노트는 선생님이 할당해야 목록에 표시됩니다",
      "인쇄하여 다시 풀어보면 학습 효과가 높아집니다"
    ],
    lastUpdated: "2026-03"
  }
];

const roleManualMap: Record<RoleType, { title: string; sections: ManualSection[] }> = {
  principal: { title: "원장", sections: principalSections },
  teacher: { title: "선생님", sections: teacherSections },
  student: { title: "학생", sections: studentSections },
};

function getDefaultRole(userRole: number): RoleType {
  if (userRole >= UserRole.PRINCIPAL) return "principal";
  if (userRole >= UserRole.TEACHER) return "teacher";
  return "student";
}

function getAccessibleRoles(userRole: number): RoleType[] {
  if (userRole >= UserRole.PRINCIPAL) return ["principal", "teacher", "student"];
  if (userRole >= UserRole.TEACHER) return ["teacher", "student"];
  return ["student"];
}

export default function ManualPage() {
  const { user } = useAuth();
  const defaultRole = user ? getDefaultRole(user.role) : "student";
  const accessibleRoles: RoleType[] = user ? getAccessibleRoles(user.role) : ["student"];
  
  const [selectedRole, setSelectedRole] = useState<RoleType>(defaultRole);
  const [selectedSection, setSelectedSection] = useState<string>("");

  const currentManual = roleManualMap[selectedRole];
  const sections = currentManual.sections;

  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.id === selectedSection)) {
      setSelectedSection(sections[0].id);
    }
  }, [selectedRole, sections, selectedSection]);

  const currentSection = sections.find(s => s.id === selectedSection);

  return (
    <div className="flex flex-col h-full">
      {accessibleRoles.length > 1 && (
        <div className="border-b p-4 bg-muted/30">
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleType)}>
            <TabsList>
              {accessibleRoles.map((role) => (
                <TabsTrigger key={role} value={role} data-testid={`tab-manual-${role}`}>
                  {roleManualMap[role].title} 계정
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="md:hidden p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5" />
            <span className="font-semibold">{currentManual.title} 매뉴얼</span>
          </div>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger data-testid="mobile-section-select">
              <SelectValue placeholder="메뉴 선택" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden md:flex w-64 border-r bg-muted/30 flex-shrink-0 flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {currentManual.title} 매뉴얼
            </h2>
            <p className="text-xs text-muted-foreground mt-1">이음위더스 사용 안내서</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                      selectedSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover-elevate"
                    }`}
                    data-testid={`manual-nav-${section.id}`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto">
          {currentSection ? (
            <div className="p-4 md:p-6 max-w-4xl">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <currentSection.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold">{currentSection.title}</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">{currentSection.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs self-start">
                  업데이트: {currentSection.lastUpdated}
                </Badge>
              </div>

              <Separator className="my-4 md:my-6" />

              <div className="space-y-4 md:space-y-6">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 md:h-5 md:w-5" />
                  주요 기능
                </h2>

                <div className="space-y-4">
                  {currentSection.features.map((feature, idx) => (
                    <Card key={idx}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                        <CardDescription>{feature.description}</CardDescription>
                      </CardHeader>
                      {feature.steps && feature.steps.length > 0 && (
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">사용 방법:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {feature.steps.map((step, stepIdx) => (
                                <li key={stepIdx} className="text-sm text-muted-foreground">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>

                {currentSection.tips && currentSection.tips.length > 0 && (
                  <>
                    <Separator className="my-4 md:my-6" />
                    <div>
                      <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">알아두세요</h2>
                      <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                          <ul className="space-y-2">
                            {currentSection.tips.map((tip, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <span className="hidden md:inline">좌측 메뉴에서 </span>
              <span className="md:hidden">위 메뉴에서 </span>
              항목을 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
