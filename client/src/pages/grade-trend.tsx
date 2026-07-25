/**
 * 종합성적추이 페이지 (Grade Trend)
 * - 월별+주차별 성장지수 꺾은선 그래프
 * - 학년별 필터 + 학생 이름 검색
 * - 선생님: 본인 수업 수강 학생만, 관리자/원장: 센터 전체 학생
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueries } from "@tanstack/react-query";
import { UserRole, type User, type Class, type Enrollment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, TrendingUp, Info, Search, Calendar, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeGrade } from "@/components/enrollment-status-table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

type MonthlyItem = { month: number; growthIndex: number | null };
type WeeklyItem = { week: number; label: string; growthIndex: number | null };
type GrowthResponse = { monthly: MonthlyItem[]; weekly: WeeklyItem[]; currentMonth: number };

function ChartComponent({ data, xKey, title, color }: { data: { name: string; 성장지수: number | null }[]; xKey: string; title: string; color: string }) {
  const validValues = data.filter(d => d.성장지수 !== null).map(d => d.성장지수!);
  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0.5;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1.5;
  const yMin = Math.floor((Math.min(minVal, 1) - 0.1) * 10) / 10;
  const yMax = Math.ceil((maxVal + 0.1) * 10) / 10;
  const avgNearBottom = (1 - yMin) < (yMax - yMin) * 0.2;
  const avgLabelPos = avgNearBottom ? "insideTopLeft" : "insideBottomLeft";

  return (
    <div>
      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        {title === "월별" ? <Calendar className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        {title} 성장지수
      </p>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip
              formatter={(value: number) => [value?.toFixed(2), "성장지수"]}
              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: "평균(1.0)", position: avgLabelPos, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Line
              type="monotone"
              dataKey="성장지수"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StudentGrowthCharts({ data, studentName, year }: { data: GrowthResponse; studentName?: string; year: number }) {
  const monthlyChartData = data.monthly.map(d => ({
    name: MONTH_LABELS[d.month - 1],
    성장지수: d.growthIndex,
  }));

  const weeklyChartData = data.weekly.map(d => ({
    name: `${d.week}주차`,
    성장지수: d.growthIndex,
  }));

  const hasMonthlyData = data.monthly.some(d => d.growthIndex !== null);
  const hasWeeklyData = data.weekly.some(d => d.growthIndex !== null);
  const currentYear = new Date().getFullYear();
  const showWeekly = year === currentYear;

  return (
    <Card>
      {studentName && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{studentName}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={studentName ? "pt-0 space-y-6" : "pt-4 space-y-6"}>
        {showWeekly && (
          hasWeeklyData ? (
            <ChartComponent
              data={weeklyChartData}
              xKey="name"
              title={`주차별 (${data.currentMonth}월)`}
              color="hsl(var(--chart-2, 142 71% 45%))"
            />
          ) : (
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                주차별 ({data.currentMonth}월) 성장지수
              </p>
              <p className="text-sm text-muted-foreground text-center py-6">이번 달 평가 데이터가 없습니다</p>
            </div>
          )
        )}

        {hasMonthlyData ? (
          <ChartComponent
            data={monthlyChartData}
            xKey="name"
            title="월별"
            color="hsl(var(--primary))"
          />
        ) : (
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              월별 성장지수
            </p>
            <p className="text-sm text-muted-foreground text-center py-6">{year}년 평가 데이터가 없습니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GrowthInfoCard() {
  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">성장지수란?</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              <span className="font-mono font-semibold">성장지수 = 학생 점수 ÷ 시험 평균</span>
            </p>
            <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-0.5 list-disc list-inside">
              <li>성장지수가 <strong>1.0 이상</strong>이면 평균 이상의 성적입니다</li>
              <li>성장지수가 <strong>1.0 미만</strong>이면 평균 이하의 성적입니다</li>
              <li>여러 수업을 수강하는 경우, 수업별 성장지수의 평균으로 계산됩니다</li>
              <li>한 달에 여러 시험을 본 경우, 점수 평균을 내어 성장지수를 계산합니다</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GradeTrendPage() {
  const { user, selectedCenter } = useAuth();
  const centerId = selectedCenter?.id || "";

  const isStudent = user?.role === UserRole.STUDENT;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL;

  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("all");
  const [selectedGradeNum, setSelectedGradeNum] = useState<string | null>(null);

  // 센터 전체 유저 목록 (관리자/원장)
  const { data: allCenterUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId && !isStudent && isAdmin,
  });

  // 선생님: 본인 수업 목록 → 수강 학생 ID 수집
  const { data: teacherClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${user?.id}/classes`, { centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/teachers/${user?.id}/classes?centerId=${centerId}`);
      return res.json();
    },
    enabled: !!user?.id && !!centerId && isTeacher,
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments?centerId=${centerId}`);
      return res.json();
    },
    enabled: !!centerId && isTeacher,
  });

  const { data: teacherCenterUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId && !isStudent && isTeacher,
  });

  // 선생님의 수업에 수강 중인 학생 ID Set
  const teacherStudentIds = useMemo(() => {
    if (!isTeacher) return new Set<string>();
    const classIds = new Set(teacherClasses.filter(c => !c.isArchived).map(c => c.id));
    const ids = new Set<string>();
    enrollments.forEach(e => {
      if (classIds.has(e.classId)) ids.add(e.studentId);
    });
    return ids;
  }, [isTeacher, teacherClasses, enrollments]);

  // 학생 풀: 관리자=전체, 선생님=본인 수업 학생만
  const studentPool = useMemo(() => {
    const users = isAdmin ? allCenterUsers : teacherCenterUsers;
    return users.filter(u => {
      if (u.role !== UserRole.STUDENT) return false;
      if (isTeacher && !teacherStudentIds.has(u.id)) return false;
      return true;
    });
  }, [isAdmin, isTeacher, allCenterUsers, teacherCenterUsers, teacherStudentIds]);

  // 학년 필터 + 이름 검색
  const filteredStudents = useMemo(() => {
    let list = studentPool;
    if (schoolLevel !== "all") {
      list = list.filter(s => {
        const ng = normalizeGrade(s.grade);
        return GRADE_LEVEL_MAP[ng] === schoolLevel;
      });
    }
    if (selectedGradeNum) {
      list = list.filter(s => normalizeGrade(s.grade) === selectedGradeNum);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [studentPool, schoolLevel, selectedGradeNum, searchQuery]);

  const studentsToShow = useMemo(() => {
    if (isStudent) return user ? [user] : [];
    if (!selectedStudentId) return [];
    const found = filteredStudents.find(s => s.id === selectedStudentId);
    return found ? [found] : [];
  }, [isStudent, user, selectedStudentId, filteredStudents]);

  const growthQueries = useQueries({
    queries: studentsToShow.map(student => ({
      queryKey: ["/api/grade-trend", student.id, year, centerId],
      queryFn: async () => {
        const res = await fetch(`/api/grade-trend/${student.id}?year=${year}&centerId=${centerId}`);
        return res.json() as Promise<GrowthResponse>;
      },
      enabled: !!student.id && !!centerId,
    })),
  });

  const studentGrowthQueries = studentsToShow.map((student, i) => ({
    student,
    data: growthQueries[i]?.data as GrowthResponse | undefined,
    isLoading: growthQueries[i]?.isLoading ?? false,
  }));

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <TrendingUp className="h-5 w-5" />
          종합성적추이
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setYear(y => y - 1)} data-testid="button-prev-year">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[60px] text-center" data-testid="text-year">{year}년</span>
          <Button variant="ghost" size="icon" onClick={() => setYear(y => y + 1)} data-testid="button-next-year">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <GrowthInfoCard />

      {!isStudent && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-medium">학생 선택</label>
              <Tabs value={schoolLevel} onValueChange={(v) => { setSchoolLevel(v as any); setSelectedStudentId(null); setSelectedGradeNum(null); }}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2 h-6" data-testid="tab-all">전체</TabsTrigger>
                  <TabsTrigger value="elementary" className="text-xs px-2 h-6" data-testid="tab-elementary">초등</TabsTrigger>
                  <TabsTrigger value="middle" className="text-xs px-2 h-6" data-testid="tab-middle">중등</TabsTrigger>
                  <TabsTrigger value="high" className="text-xs px-2 h-6" data-testid="tab-high">고등</TabsTrigger>
                  <TabsTrigger value="adult" className="text-xs px-2 h-6" data-testid="tab-adult">성인</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {(schoolLevel === "elementary" || schoolLevel === "middle" || schoolLevel === "high") && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={selectedGradeNum === null ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setSelectedGradeNum(null); setSelectedStudentId(null); }}
                  data-testid="button-grade-all"
                >
                  전체
                </Button>
                {(schoolLevel === "elementary"
                  ? ["초1","초2","초3","초4","초5","초6"]
                  : schoolLevel === "middle"
                    ? ["중1","중2","중3"]
                    : ["고1","고2","고3"]
                ).map(g => (
                  <Button
                    key={g}
                    variant={selectedGradeNum === g ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setSelectedGradeNum(g); setSelectedStudentId(null); }}
                    data-testid={`button-grade-${g}`}
                  >
                    {g.replace("초","").replace("중","").replace("고","")}학년
                  </Button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생 이름 검색"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedStudentId(null); }}
                className="pl-9"
                data-testid="input-search-student"
              />
            </div>
            {filteredStudents.length > 0 && (
              <ScrollArea className="h-52 border rounded-md">
                <div className="divide-y">
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors
                        ${selectedStudentId === s.id ? "bg-primary/10 font-semibold" : ""}`}
                      onClick={() => setSelectedStudentId(s.id)}
                      data-testid={`button-student-${s.id}`}
                    >
                      <span>{s.name}</span>
                      {s.grade && <span className="text-xs text-muted-foreground">{normalizeGrade(s.grade)}</span>}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            {filteredStudents.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {searchQuery ? "검색 결과가 없습니다" : "학생이 없습니다"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(isStudent || studentsToShow.length > 0) && (
        <div className="space-y-4">
          {studentGrowthQueries.map(({ student, data, isLoading }) => (
            <div key={student.id}>
              {isLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">로딩 중...</CardContent></Card>
              ) : data ? (
                <StudentGrowthCharts data={data} studentName={!isStudent ? student.name : undefined} year={year} />
              ) : (
                <Card>
                  {!isStudent && <CardHeader className="pb-2"><CardTitle className="text-base">{student.name}</CardTitle></CardHeader>}
                  <CardContent className="pt-0 pb-4 text-center text-sm text-muted-foreground">평가 데이터가 없습니다</CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {!isStudent && !selectedStudentId && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">학생을 선택하세요</CardContent></Card>
      )}
    </div>
  );
}
