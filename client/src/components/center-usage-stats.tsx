import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, Clock, RotateCcw, BarChart3, TrendingUp, Eye, HelpCircle, User, Calendar, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Center } from "@shared/schema";
import { UserRole } from "@shared/schema";

interface MonthlyStats {
  month: number;
  uniqueUsers: number;
  totalSessions: number;
  returnRate: number;
  avgDurationMinutes: number;
  topPages: { path: string; count: number }[];
}

interface UsageStats {
  year: number;
  centerId: string;
  monthlyStats: MonthlyStats[];
}

interface UserStats {
  userId: string;
  userName: string;
  userRole: number;
  totalSessions: number;
  totalPageViews: number;
  daysActive: number;
  totalDurationMinutes: number;
  lastActive: string | null;
  topPages: { path: string; count: number }[];
}

interface UserUsageStats {
  year: number;
  centerId: string;
  userStats: UserStats[];
}

const roleNames: Record<number, string> = {
  [UserRole.ADMIN]: "관리자",
  [UserRole.PRINCIPAL]: "원장",
  [UserRole.TEACHER]: "선생님",
  [UserRole.CLINIC_TEACHER]: "클리닉",
  [UserRole.STUDENT]: "학생",
  [UserRole.PARENT]: "학부모",
  [UserRole.KIOSK]: "출결 계정",
};

const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const pageNameMap: Record<string, string> = {
  "/": "대시보드",
  "/timetable": "시간표",
  "/my-timetable": "내 시간표",
  "/homework": "숙제",
  "/assessments": "평가",
  "/videos": "수업 영상",
  "/textbooks": "교재",
  "/users": "사용자 관리",
  "/centers": "센터 관리",
  "/settings": "설정",
  "/clinic": "클리닉",
  "/attendance": "출결 관리",
  "/class-notes": "수업 기록",
  "/study-cafe": "스터디 카페",
  "/jcomputer-timetable": "제이컴퓨터 시간표",
  "/tuition": "수강료",
  "/student-reports": "학생 리포트",
  "/todos": "업무관리",
  "/management": "운영 관리",
  "/academy-calendar": "학원 캘린더",
  "/contact-parents": "문자 전송",
  "/face-to-face-checks": "대면검사",
  "/feature-management": "추가 기능 메뉴",
  "/manual": "매뉴얼",
  "/attendance-pad": "출결 패드",
  "/login": "로그인",
  "/center-registration": "학원등록 신청",
  "/textbook-videos": "교재 영상",
};

function getPageName(path: string): string {
  return pageNameMap[path] || path;
}

function StatExplanation({ title, explanation }: { title: string; explanation: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs p-3" side="top">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
      </PopoverContent>
    </Popover>
  );
}

export function CenterUsageStats({ center }: { center: Center }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("monthly");
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const { data: stats, isLoading } = useQuery<UsageStats>({
    queryKey: ["/api/centers", center.id, "usage-stats", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${center.id}/usage-stats?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch usage stats");
      return res.json();
    }
  });

  const { data: userStats, isLoading: isLoadingUserStats } = useQuery<UserUsageStats>({
    queryKey: ["/api/centers", center.id, "user-usage-stats", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${center.id}/user-usage-stats?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch user usage stats");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const yearTotals = stats?.monthlyStats.reduce((acc, month) => ({
    totalUsers: acc.totalUsers + month.uniqueUsers,
    totalSessions: acc.totalSessions + month.totalSessions,
    avgReturnRate: acc.avgReturnRate + month.returnRate,
    avgDuration: acc.avgDuration + month.avgDurationMinutes
  }), { totalUsers: 0, totalSessions: 0, avgReturnRate: 0, avgDuration: 0 });

  const monthsWithData = stats?.monthlyStats.filter(m => m.uniqueUsers > 0).length || 1;
  const avgReturnRate = yearTotals ? Math.round(yearTotals.avgReturnRate / monthsWithData * 10) / 10 : 0;
  const avgDuration = yearTotals ? Math.round(yearTotals.avgDuration / monthsWithData * 10) / 10 : 0;

  const allTopPages = new Map<string, number>();
  stats?.monthlyStats.forEach(month => {
    month.topPages.forEach(page => {
      allTopPages.set(page.path, (allTopPages.get(page.path) || 0) + page.count);
    });
  });
  const sortedTopPages = Array.from(allTopPages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const maxUsers = Math.max(...(stats?.monthlyStats.map(m => m.uniqueUsers) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">월별 사용자 활동 및 앱 이용 현황</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2" data-testid="tab-monthly">
            <Calendar className="h-4 w-4" />
            월별 통계
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-2" data-testid="tab-retention">
            <Activity className="h-4 w-4" />
            리텐션 분석
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
            <User className="h-4 w-4" />
            계정별 통계
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>연간 활성 사용자</span>
              <StatExplanation 
                title="연간 활성 사용자" 
                explanation="해당 연도에 앱을 한 번이라도 사용한 고유 사용자 수의 월별 합계입니다." 
              />
            </div>
            <p className="text-2xl font-bold mt-1">{yearTotals?.totalUsers.toLocaleString() || 0}명</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>연간 세션 수</span>
              <StatExplanation 
                title="연간 세션 수" 
                explanation="사용자가 앱에 접속한 총 횟수입니다. 한 사용자가 여러 번 접속하면 각각 세션으로 카운트됩니다." 
              />
            </div>
            <p className="text-2xl font-bold mt-1">{yearTotals?.totalSessions.toLocaleString() || 0}회</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
              <span>평균 재방문률</span>
              <StatExplanation 
                title="평균 재방문률" 
                explanation="한 달 내에 2일 이상 앱을 사용한 사용자의 비율입니다. 높을수록 사용자가 자주 앱을 이용하고 있습니다." 
              />
            </div>
            <p className="text-2xl font-bold mt-1">{avgReturnRate}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>평균 이용시간</span>
              <StatExplanation 
                title="평균 이용시간" 
                explanation="사용자가 한 페이지에 머무는 평균 시간입니다. 길수록 사용자가 콘텐츠에 관심을 갖고 있습니다." 
              />
            </div>
            <p className="text-2xl font-bold mt-1">{avgDuration}분</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            월별 활성 사용자 추이
          </CardTitle>
          <CardDescription>각 월의 고유 사용자 수를 막대 그래프로 표시</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {stats?.monthlyStats.map((month, idx) => {
              const height = maxUsers > 0 ? (month.uniqueUsers / maxUsers) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="w-full bg-primary/80 hover:bg-primary rounded-t cursor-pointer transition-colors"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">{monthNames[idx]}</p>
                        <p>사용자: {month.uniqueUsers}명</p>
                        <p>세션: {month.totalSessions}회</p>
                        <p>재방문률: {month.returnRate}%</p>
                        <p>평균 체류: {month.avgDurationMinutes}분</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs text-muted-foreground">{idx + 1}월</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">가장 많이 사용하는 메뉴 (연간)</CardTitle>
            <CardDescription>페이지 방문 횟수 기준 상위 10개</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedTopPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">데이터가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {sortedTopPages.map(([path, count], idx) => (
                  <div key={path} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {idx + 1}
                      </Badge>
                      <span className="text-sm">{getPageName(path)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count.toLocaleString()}회</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">월별 상세 통계</CardTitle>
            <CardDescription>각 월의 세부 지표</CardDescription>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">월</th>
                  <th className="text-right py-2 font-medium">사용자</th>
                  <th className="text-right py-2 font-medium">세션</th>
                  <th className="text-right py-2 font-medium">재방문</th>
                  <th className="text-right py-2 font-medium">체류</th>
                </tr>
              </thead>
              <tbody>
                {stats?.monthlyStats.map((month, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">{monthNames[idx]}</td>
                    <td className="text-right py-2">{month.uniqueUsers}명</td>
                    <td className="text-right py-2">{month.totalSessions}회</td>
                    <td className="text-right py-2">{month.returnRate}%</td>
                    <td className="text-right py-2">{month.avgDurationMinutes}분</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          </Card>
          </div>
        </TabsContent>

        <RetentionTab centerId={center.id} />

        <TabsContent value="users" className="mt-4">
          {isLoadingUserStats ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  계정별 사용 현황
                </CardTitle>
                <CardDescription>
                  {selectedYear}년 기준 각 계정의 앱 사용 통계입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userStats?.userStats && userStats.userStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">이름</th>
                          <th className="text-left py-2 font-medium">역할</th>
                          <th className="text-right py-2 font-medium">세션</th>
                          <th className="text-right py-2 font-medium">페이지뷰</th>
                          <th className="text-right py-2 font-medium">활동일</th>
                          <th className="text-right py-2 font-medium">총 사용시간</th>
                          <th className="text-left py-2 font-medium">최근 접속</th>
                          <th className="text-left py-2 font-medium">주요 메뉴</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userStats.userStats.map((user) => (
                          <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-2 font-medium">{user.userName}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">
                                {roleNames[user.userRole] || "알 수 없음"}
                              </Badge>
                            </td>
                            <td className="text-right py-2">{user.totalSessions}회</td>
                            <td className="text-right py-2">{user.totalPageViews}회</td>
                            <td className="text-right py-2">{user.daysActive}일</td>
                            <td className="text-right py-2">
                              {user.totalDurationMinutes >= 60 
                                ? `${Math.floor(user.totalDurationMinutes / 60)}시간 ${user.totalDurationMinutes % 60}분`
                                : `${user.totalDurationMinutes}분`
                              }
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {user.lastActive 
                                ? new Date(user.lastActive).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                                : "-"
                              }
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {user.topPages.slice(0, 3).map((page, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {getPageName(page.path)}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{selectedYear}년에 기록된 사용 데이터가 없습니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RetentionStats {
  year: number;
  month: number;
  totalMembers: number;
  mau: number;
  avgDau: number;
  avgDay1Retention: number | null;
  avgDay7Retention: number | null;
  avgDay30Retention: number | null;
  avgStickiness: number;
  dailyStats: {
    date: string;
    day: number;
    dau: number;
    day1Retention: number | null;
    day7Retention: number | null;
    day30Retention: number | null;
    stickiness: number;
  }[];
}

function RetentionTab({ centerId }: { centerId: string }) {
  const now = new Date();
  const [retYear, setRetYear] = useState(now.getFullYear());
  const [retMonth, setRetMonth] = useState(now.getMonth() + 1);

  const { data: retentionStats, isLoading: retLoading } = useQuery<RetentionStats>({
    queryKey: ["/api/centers", centerId, "retention-stats", retYear, retMonth],
    queryFn: async () => {
      const res = await fetch(`/api/centers/${centerId}/retention-stats?year=${retYear}&month=${retMonth}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const handlePrevMonth = () => {
    if (retMonth === 1) { setRetYear(retYear - 1); setRetMonth(12); }
    else setRetMonth(retMonth - 1);
  };
  const handleNextMonth = () => {
    if (retMonth === 12) { setRetYear(retYear + 1); setRetMonth(1); }
    else setRetMonth(retMonth + 1);
  };

  const firstDayOfWeek = new Date(retYear, retMonth - 1, 1).getDay();
  const daysInMonth = new Date(retYear, retMonth, 0).getDate();

  const getRetentionColor = (value: number | null) => {
    if (value === null || value === 0) return "";
    if (value >= 50) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    if (value >= 30) return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
    if (value >= 10) return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
    return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400";
  };

  // null = 아직 측정 불가(대상 날짜가 미래). 측정된 0%와 구분해 "측정 중"으로 표시.
  const fmtRet = (value: number | null) => (value === null ? "측정 중" : `${value}%`);

  return (
    <TabsContent value="retention" className="mt-4 space-y-6">
      {retLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>회원수</span>
                  <StatExplanation title="회원수" explanation="해당 센터에 소속된 전체 계정 수입니다." />
                </div>
                <p className="text-xl font-bold mt-1">{retentionStats?.totalMembers || 0}명</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Day 1</span>
                  <StatExplanation title="Day 1 재방문률" explanation="특정 날짜에 방문한 사용자 중, 다음 날 다시 방문한 사용자의 비율입니다. 월 평균값입니다." />
                </div>
                <p className="text-xl font-bold mt-1">{fmtRet(retentionStats?.avgDay1Retention ?? null)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Day 7</span>
                  <StatExplanation title="Day 7 재방문률" explanation="특정 날짜에 방문한 사용자 중, 7일 후 다시 방문한 사용자의 비율입니다. 월 평균값입니다." />
                </div>
                <p className="text-xl font-bold mt-1">{fmtRet(retentionStats?.avgDay7Retention ?? null)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Day 30</span>
                  <StatExplanation title="Day 30 재방문률" explanation="특정 날짜에 방문한 사용자 중, 30일 후 다시 방문한 사용자의 비율입니다. 월 평균값입니다." />
                </div>
                <p className="text-xl font-bold mt-1">{fmtRet(retentionStats?.avgDay30Retention ?? null)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  <span>DAU/MAU</span>
                  <StatExplanation title="DAU/MAU (Stickiness)" explanation="일간 활성 사용자(DAU)를 월간 활성 사용자(MAU)로 나눈 비율입니다. 높을수록 사용자가 매일 앱을 자주 이용합니다. 20% 이상이면 양호합니다." />
                </div>
                <p className="text-xl font-bold mt-1">{retentionStats?.avgStickiness || 0}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  일별 리텐션 달력
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth} data-testid="button-retention-prev">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">{retYear}년 {retMonth}월</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth} data-testid="button-retention-next">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>각 날짜의 DAU, Day 1/7/30 재방문률, Stickiness를 확인합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {retentionStats?.dailyStats.map((day) => (
                  <Tooltip key={day.day}>
                    <TooltipTrigger asChild>
                      <div className={`aspect-square rounded-md border p-1 cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all flex flex-col items-center justify-center ${day.dau > 0 ? 'bg-muted/30' : ''}`}>
                        <span className="text-xs font-medium">{day.day}</span>
                        {day.dau > 0 ? (
                          <>
                            <span className="text-[10px] text-primary font-semibold">{day.dau}명</span>
                            <span className={`text-[9px] font-medium rounded px-0.5 ${getRetentionColor(day.day1Retention)}`}>
                              D1:{day.day1Retention === null ? "-" : `${day.day1Retention}%`}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">-</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-xs space-y-1">
                        <p className="font-medium">{retYear}년 {retMonth}월 {day.day}일</p>
                        <p>DAU: {day.dau}명</p>
                        <p>Day 1 재방문률: {fmtRet(day.day1Retention)}</p>
                        <p>Day 7 재방문률: {fmtRet(day.day7Retention)}</p>
                        <p>Day 30 재방문률: {fmtRet(day.day30Retention)}</p>
                        <p>Stickiness (DAU/MAU): {day.stickiness}%</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4 text-[10px] text-muted-foreground justify-end">
                <span>Day 1 재방문률 범례:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/20 border" /> &lt;10%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-900/20 border" /> 10-30%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-900/20 border" /> 30-50%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border" /> 50%+</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">일별 상세 데이터</CardTitle>
              <CardDescription>각 날짜별 리텐션 지표</CardDescription>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">날짜</th>
                    <th className="text-right py-2 font-medium">DAU</th>
                    <th className="text-right py-2 font-medium">Day 1</th>
                    <th className="text-right py-2 font-medium">Day 7</th>
                    <th className="text-right py-2 font-medium">Day 30</th>
                    <th className="text-right py-2 font-medium">DAU/MAU</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionStats?.dailyStats.filter(d => d.dau > 0).map((day) => (
                    <tr key={day.day} className="border-b last:border-0">
                      <td className="py-2">{day.day}일</td>
                      <td className="text-right py-2">{day.dau}명</td>
                      <td className={`text-right py-2 ${getRetentionColor(day.day1Retention)}`}>{fmtRet(day.day1Retention)}</td>
                      <td className={`text-right py-2 ${getRetentionColor(day.day7Retention)}`}>{fmtRet(day.day7Retention)}</td>
                      <td className={`text-right py-2 ${getRetentionColor(day.day30Retention)}`}>{fmtRet(day.day30Retention)}</td>
                      <td className="text-right py-2">{day.stickiness}%</td>
                    </tr>
                  ))}
                  {retentionStats?.dailyStats.filter(d => d.dau > 0).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted-foreground">해당 월에 활동 데이터가 없습니다</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </TabsContent>
  );
}
