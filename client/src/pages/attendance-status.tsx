/**
 * 출결현황 페이지 (Attendance Status)
 * - 달력 형태로 월별 출결 기록 표시 (등원 시각, 하원 시각)
 * - 학년별 필터 + 학생 이름 검색
 * - 선생님: 본인 수업 수강 학생만, 관리자/원장: 센터 전체 학생
 * - 최대 1년 전까지 조회 가능
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { UserRole, type User, type Class, type Enrollment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarCheck, Search, Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeGrade } from "@/components/enrollment-status-table";

type AttendanceRecord = {
  id: string;
  studentId: string;
  centerId: string;
  classId?: string;
  checkInAt: string;
  checkInDate: string;
  checkOutAt?: string | null;
  attendanceStatus: string;
  wasLate?: boolean;
  lateNotificationSentAt?: string | null;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function RecordLabel({ r }: { r: AttendanceRecord }) {
  const isAbsent = r.attendanceStatus === "absent";
  const isCurrentlyLate = r.attendanceStatus === "late";
  const wasLateButPresent = r.wasLate && r.attendanceStatus === "present";

  if (wasLateButPresent) {
    return (
      <>
        <div className="font-medium text-orange-600 dark:text-orange-400">
          지각 {r.lateNotificationSentAt ? formatTime(r.lateNotificationSentAt) : ""}
        </div>
        <div className="font-medium text-emerald-600 dark:text-emerald-400">
          등원 {formatTime(r.checkInAt)}
        </div>
        {r.checkOutAt && (
          <div className="text-blue-600 dark:text-blue-400">
            하원 {formatTime(r.checkOutAt)}
          </div>
        )}
      </>
    );
  }

  const label = isAbsent ? "결석" : isCurrentlyLate ? "지각" : "등원";
  const color = isAbsent
    ? "text-red-600 dark:text-red-400"
    : isCurrentlyLate
      ? "text-orange-600 dark:text-orange-400 font-bold"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <>
      <div className={`font-medium ${color}`}>
        {label} {isAbsent ? "" : formatTime(r.checkInAt)}
      </div>
      {r.checkOutAt && (
        <div className="text-blue-600 dark:text-blue-400">
          하원 {formatTime(r.checkOutAt)}
        </div>
      )}
    </>
  );
}

function DayDetailDialog({
  day, month, year, records, onClose,
}: {
  day: number; month: number; year: number; records: AttendanceRecord[]; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl border w-[320px] max-h-[80vh] overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{year}년 {month}월 {day}일 출결 상세</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="button-close-day-detail">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {records.map((r, ri) => {
            const isAbsent = r.attendanceStatus === "absent";
            const isCurrentlyLate = r.attendanceStatus === "late";
            const wasLateButPresent = r.wasLate && r.attendanceStatus === "present";

            if (wasLateButPresent) {
              return (
                <div key={r.id || ri} className="space-y-1">
                  <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-orange-500" />
                    <div>
                      <div className="font-medium text-orange-600 dark:text-orange-400">
                        지각 {r.lateNotificationSentAt ? formatTime(r.lateNotificationSentAt) : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-emerald-500" />
                    <div>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">
                        등원 {formatTime(r.checkInAt)}
                      </div>
                      {r.checkOutAt && (
                        <div className="text-blue-600 dark:text-blue-400 text-xs">
                          하원 {formatTime(r.checkOutAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const label = isAbsent ? "결석" : isCurrentlyLate ? "지각" : "등원";
            const dotColor = isAbsent ? "bg-red-500" : isCurrentlyLate ? "bg-orange-500" : "bg-emerald-500";
            const textColor = isAbsent
              ? "text-red-600 dark:text-red-400"
              : isCurrentlyLate
                ? "text-orange-600 dark:text-orange-400"
                : "text-emerald-600 dark:text-emerald-400";
            return (
              <div key={r.id || ri} className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${dotColor}`} />
                <div>
                  <div className={`font-medium ${textColor}`}>
                    {label} {isAbsent ? "" : formatTime(r.checkInAt)}
                  </div>
                  {r.checkOutAt && (
                    <div className="text-blue-600 dark:text-blue-400 text-xs">
                      하원 {formatTime(r.checkOutAt)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MAX_VISIBLE_RECORDS = 2;

function AttendanceCalendar({
  records, year, month, studentName,
}: {
  records: AttendanceRecord[]; year: number; month: number; studentName?: string;
}) {
  const [detailDay, setDetailDay] = useState<number | null>(null);
  const days = getCalendarDays(year, month);

  const recordsByDate = useMemo(() => {
    const map = new Map<number, AttendanceRecord[]>();
    records.forEach(r => {
      const dateStr = r.checkInDate;
      if (dateStr) {
        const parts = dateStr.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (y === year && m === month) {
          if (!map.has(d)) map.set(d, []);
          map.get(d)!.push(r);
        }
      }
    });
    map.forEach((recs) => {
      recs.sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
    });
    return map;
  }, [records, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const attendanceDays = recordsByDate.size;

  const detailRecords = detailDay !== null ? (recordsByDate.get(detailDay) || []) : [];

  return (
    <Card>
      {studentName && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{studentName}</CardTitle>
            <Badge variant="secondary" className="text-xs">출석 {attendanceDays}일</Badge>
          </div>
        </CardHeader>
      )}
      {!studentName && (
        <CardHeader className="pb-2">
          <div className="flex justify-end">
            <Badge variant="secondary" className="text-xs">출석 {attendanceDays}일</Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((label, i) => (
            <div key={label} className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="min-h-[64px]" />;

            const dayRecords = recordsByDate.get(day) || [];
            const hasRecord = dayRecords.length > 0;
            const hasLate = dayRecords.some(r => r.wasLate || r.attendanceStatus === "late");
            const isToday = isCurrentMonth && today.getDate() === day;
            const dayOfWeek = (idx % 7);
            const visibleRecords = dayRecords.slice(0, MAX_VISIBLE_RECORDS);
            const extraCount = dayRecords.length - MAX_VISIBLE_RECORDS;

            return (
              <div
                key={day}
                className={`min-h-[64px] p-0.5 rounded-md border text-center relative cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow
                  ${isToday ? "border-primary bg-primary/5" : "border-transparent"}
                  ${hasRecord ? (hasLate ? "bg-orange-50 dark:bg-orange-950/20" : "bg-emerald-50 dark:bg-emerald-950/30") : ""}`}
                data-testid={`calendar-day-${day}`}
                onClick={() => hasRecord && setDetailDay(day)}
              >
                <div className={`text-xs font-medium mb-0.5
                  ${dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""}
                  ${isToday ? "text-primary font-bold" : ""}`}>
                  {day}
                </div>
                {hasRecord && (
                  <div className="text-[9px] leading-tight space-y-px">
                    {visibleRecords.map((r, ri) => (
                      <div key={r.id || ri}>
                        <RecordLabel r={r} />
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div className="text-[9px] text-primary font-semibold mt-0.5">
                        +{extraCount}건 더보기
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 등원</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> 지각</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 하원</span>
        </div>
      </CardContent>

      {detailDay !== null && detailRecords.length > 0 && (
        <DayDetailDialog
          day={detailDay}
          month={month}
          year={year}
          records={detailRecords}
          onClose={() => setDetailDay(null)}
        />
      )}
    </Card>
  );
}

export default function AttendanceStatusPage() {
  const { user, selectedCenter } = useAuth();
  const centerId = selectedCenter?.id || "";

  const isStudent = user?.role === UserRole.STUDENT;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("all");
  const [selectedGradeNum, setSelectedGradeNum] = useState<string | null>(null);

  const minDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const canGoPrev = new Date(year, month - 2, 1) >= minDate;
  const canGoNext = new Date(year, month, 1) <= now;

  const goToPrev = () => {
    if (!canGoPrev) return;
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (!canGoNext) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const { data: allCenterUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/users?centerId=${centerId}`],
    enabled: !!centerId && !isStudent,
  });

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

  const teacherStudentIds = useMemo(() => {
    if (!isTeacher) return new Set<string>();
    const classIds = new Set(teacherClasses.filter(c => !c.isArchived).map(c => c.id));
    const ids = new Set<string>();
    enrollments.forEach(e => {
      if (classIds.has(e.classId)) ids.add(e.studentId);
    });
    return ids;
  }, [isTeacher, teacherClasses, enrollments]);

  const studentPool = useMemo(() => {
    return allCenterUsers.filter(u => {
      if (u.role !== UserRole.STUDENT) return false;
      if (isTeacher && !teacherStudentIds.has(u.id)) return false;
      return true;
    });
  }, [isTeacher, allCenterUsers, teacherStudentIds]);

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

  const viewStudentId = isStudent ? user?.id : selectedStudentId;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  const { data: attendanceRecords = [], isLoading: loadingRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/history", viewStudentId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/history/${viewStudentId}?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!viewStudentId,
  });

  const viewStudentName = useMemo(() => {
    if (isStudent) return undefined;
    if (!selectedStudentId) return undefined;
    const s = allCenterUsers.find(s => s.id === selectedStudentId);
    return s?.name;
  }, [isStudent, selectedStudentId, allCenterUsers]);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <CalendarCheck className="h-5 w-5" />
          출결현황
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrev} disabled={!canGoPrev} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[80px] text-center" data-testid="text-month">
            {year}년 {month}월
          </span>
          <Button variant="ghost" size="icon" onClick={goToNext} disabled={!canGoNext} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">출결현황 안내</p>
              <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-0.5 list-disc list-inside">
                <li>등원 시각은 <span className="text-emerald-600 font-medium">초록색</span>, 하원 시각은 <span className="text-blue-600 font-medium">파란색</span>으로 표시됩니다</li>
                <li>지각 시에는 <span className="text-orange-600 font-medium">주황색</span>으로 표시됩니다</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {viewStudentId ? (
        loadingRecords ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">로딩 중...</CardContent></Card>
        ) : (
          <AttendanceCalendar
            records={attendanceRecords}
            year={year}
            month={month}
            studentName={viewStudentName}
          />
        )
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">학생을 선택하세요</CardContent></Card>
      )}
    </div>
  );
}
