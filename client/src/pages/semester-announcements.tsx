import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Plus, Trash2, Edit, Eye, Send, Archive,
  BookOpen, Clock, MapPin, User as UserIcon, Loader2,
  ChevronDown, ChevronUp, GraduationCap,
  Calendar, Check, X, Users, FileText, Megaphone, UserPlus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole, type SemesterAnnouncement, type SemesterAnnouncementClass, type SemesterRecommendation, type SemesterApplication, type User as UserType, type Enrollment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ManualButton } from "@/components/manual-button";
import { normalizeGrade } from "@/components/enrollment-status-table";

const DAY_LABELS: Record<string, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일"
};

const DAY_ORDER: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6
};

function sortDays(days: string[]): string[] {
  return days.slice().sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));
}

function formatDays(days: string[] | undefined, separator = ""): string {
  if (!days) return "";
  return sortDays(days).map(d => DAY_LABELS[d] || d).join(separator);
}

function classDaySortKey(cls?: { days?: string[]; startTime?: string }): [number, number] {
  const startMinutes = cls?.startTime ? timeToMinutes(cls.startTime) : 99999;
  if (!cls || !cls.days || cls.days.length === 0) return [99, startMinutes];
  const earliestDay = Math.min(...cls.days.map(d => DAY_ORDER[d] ?? 99));
  return [earliestDay, startMinutes];
}

function compareByClassDay(
  a?: { days?: string[]; startTime?: string },
  b?: { days?: string[]; startTime?: string }
): number {
  const [ad, at] = classDaySortKey(a);
  const [bd, bt] = classDaySortKey(b);
  if (ad !== bd) return ad - bd;
  return at - bt;
}

const CLASS_LEVEL_LABELS: Record<string, string> = {
  elementary: "초등", middle: "중등", high: "고등", adult: "성인", all: "전체"
};

const COLOR_OPTIONS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "초안", variant: "secondary" },
  published: { label: "게시됨", variant: "default" },
  archived: { label: "보관됨", variant: "outline" },
};

const DAYS_ORDER = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

function generateTimeSlots(startHour: number, endHour: number) {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function roundToSlot(minutes: number) {
  return Math.floor(minutes / 15) * 15;
}

function InteractiveTimetableGrid({ 
  classes, 
  onClassClick,
  recommendations,
  isStaff
}: { 
  classes: SemesterAnnouncementClass[];
  onClassClick?: (cls: SemesterAnnouncementClass) => void;
  recommendations?: SemesterRecommendation[];
  isStaff?: boolean;
}) {
  const getClassesForSlot = useCallback((day: string, time: string) => {
    return classes.filter((cls) => {
      if (!cls.days.includes(day)) return false;
      const slotMin = timeToMinutes(time);
      const startMin = timeToMinutes(cls.startTime);
      const endMin = timeToMinutes(cls.endTime);
      return slotMin >= roundToSlot(startMin) && slotMin < endMin;
    });
  }, [classes]);

  const isClassStart = useCallback((cls: SemesterAnnouncementClass, day: string, time: string) => {
    const startMin = timeToMinutes(cls.startTime);
    const slotMin = timeToMinutes(time);
    return roundToSlot(startMin) === slotMin;
  }, []);

  const getClassDuration = useCallback((cls: SemesterAnnouncementClass) => {
    const durationMin = timeToMinutes(cls.endTime) - timeToMinutes(cls.startTime);
    return Math.max(1, Math.ceil(durationMin / 15));
  }, []);

  const recCountMap = useMemo(() => {
    const map = new Map<string, number>();
    recommendations?.forEach(r => {
      map.set(r.announcementClassId, (map.get(r.announcementClassId) || 0) + 1);
    });
    return map;
  }, [recommendations]);

  const visibleSlots = useMemo(() => {
    if (classes.length === 0) return generateTimeSlots(9, 22);
    let minH = 24, maxH = 0;
    classes.forEach(cls => {
      const sh = parseInt(cls.startTime.split(":")[0]);
      const eh = Math.ceil(timeToMinutes(cls.endTime) / 60);
      if (sh < minH) minH = sh;
      if (eh > maxH) maxH = eh;
    });
    const padStart = Math.max(0, minH - 1);
    const padEnd = Math.min(23, maxH + 1);
    const allSlots = generateTimeSlots(padStart, padEnd);
    return allSlots;
  }, [classes]);

  const assignColumnIndices = useCallback((day: string) => {
    const dayClasses = classes.filter((cls) => cls.days.includes(day));
    if (dayClasses.length === 0) return { assignments: new Map<string, number>(), maxColumns: 1 };

    const events: { time: number; type: 'start' | 'end'; classId: string }[] = [];
    dayClasses.forEach((cls) => {
      events.push({ time: timeToMinutes(cls.startTime), type: 'start', classId: cls.id });
      events.push({ time: timeToMinutes(cls.endTime), type: 'end', classId: cls.id });
    });

    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'end' ? -1 : 1;
    });

    const assignments = new Map<string, number>();
    const activeColumns: (string | null)[] = [];
    let maxColumns = 1;

    events.forEach((event) => {
      if (event.type === 'start') {
        let columnIdx = activeColumns.findIndex((col) => col === null);
        if (columnIdx === -1) {
          columnIdx = activeColumns.length;
          activeColumns.push(event.classId);
        } else {
          activeColumns[columnIdx] = event.classId;
        }
        assignments.set(event.classId, columnIdx);
        maxColumns = Math.max(maxColumns, activeColumns.filter(c => c !== null).length);
      } else {
        const columnIdx = assignments.get(event.classId);
        if (columnIdx !== undefined && columnIdx < activeColumns.length) {
          activeColumns[columnIdx] = null;
        }
      }
    });

    return { assignments, maxColumns };
  }, [classes]);

  const dayData = useMemo(() =>
    DAYS_ORDER.map((day) => {
      const { assignments, maxColumns } = assignColumnIndices(day.key);
      return { ...day, assignments, maxColumns };
    }),
    [assignColumnIndices]
  );

  const hasOverlap = useMemo(() => dayData.some(d => d.maxColumns > 1), [dayData]);

  if (classes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8" data-testid="text-no-classes">
        등록된 수업이 없습니다
      </div>
    );
  }

  const renderedClasses = new Set<string>();

  if (hasOverlap) {
    const slotHeight = 20;

    return (
      <div className="overflow-x-auto" data-testid="timetable-grid">
        <div className="min-w-[700px]">
          <div className="flex border-b">
            <div className="w-14 shrink-0 h-8 flex items-center justify-center font-medium text-sm bg-muted rounded-l">
              시간
            </div>
            {dayData.map((day) => (
              <div
                key={day.key}
                className="h-8 flex items-center justify-center font-medium text-sm bg-muted border-l flex-1"
                style={{ minWidth: `${Math.max(80, day.maxColumns * 80)}px` }}
              >
                {day.label}
              </div>
            ))}
          </div>

          {visibleSlots.map((time) => {
            const isFullHour = time.endsWith(":00");

            return (
              <div key={time} className="flex">
                <div className={cn(
                  "w-14 shrink-0 flex items-center justify-center text-xs text-muted-foreground border-r",
                  isFullHour ? "border-b" : "border-b border-dashed border-border/30",
                  !isFullHour && "opacity-50"
                )} style={{ height: `${slotHeight}px` }}>
                  {isFullHour && time}
                </div>

                {dayData.map((day) => {
                  const slotClasses = getClassesForSlot(day.key, time);
                  const startingClasses = slotClasses.filter(
                    c => isClassStart(c, day.key, time) && !renderedClasses.has(`${c.id}-${day.key}`)
                  );
                  startingClasses.forEach(c => renderedClasses.add(`${c.id}-${day.key}`));

                  const colWidth = Math.max(80, day.maxColumns * 80);
                  const classWidth = day.maxColumns > 1 ? (colWidth / day.maxColumns) - 2 : colWidth - 4;

                  return (
                    <div
                      key={`${day.key}-${time}`}
                      className={cn(
                        "border-l relative flex-1",
                        isFullHour ? "border-b" : "border-b border-dashed border-border/30"
                      )}
                      style={{ height: `${slotHeight}px`, minWidth: `${colWidth}px` }}
                    >
                      {startingClasses.map(cls => {
                        const duration = getClassDuration(cls);
                        const recCount = recCountMap.get(cls.id) || 0;
                        const columnIdx = day.assignments.get(cls.id) ?? 0;

                        return (
                          <button
                            key={cls.id}
                            onClick={() => onClassClick?.(cls)}
                            className="absolute rounded-sm p-0.5 md:p-1 text-left text-[8px] md:text-[10px] font-medium cursor-pointer transition-all hover:brightness-95 active:brightness-90 overflow-hidden"
                            style={{
                              backgroundColor: cls.color,
                              height: `${duration * slotHeight}px`,
                              width: `${classWidth}px`,
                              left: `${columnIdx * (classWidth + 2) + 1}px`,
                              zIndex: 10,
                              color: "#1a1a1a",
                            }}
                            data-testid={`timetable-class-${cls.id}`}
                          >
                            <p className="truncate font-semibold leading-tight">{cls.name} {cls.subject}반</p>
                            <p className="text-[7px] md:text-[9px] opacity-70 truncate">
                              {cls.startTime}-{cls.endTime}
                            </p>
                            {cls.teacherName && (
                              <p className="text-[7px] md:text-[9px] opacity-70 truncate">
                                {cls.teacherName}
                              </p>
                            )}
                            {isStaff && recCount > 0 && (
                              <span
                                className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[8px] flex items-center justify-center font-bold"
                                data-testid={`badge-rec-count-${cls.id}`}
                              >
                                {recCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="timetable-grid">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS_ORDER.map(day => (
            <div key={day.key} className="h-8 flex items-center justify-center font-medium text-sm bg-muted rounded-sm">
              {day.label}
            </div>
          ))}

          {visibleSlots.map((time) => {
            const isFullHour = time.endsWith(":00");
            return (
              <div key={time} className="contents">
                {DAYS_ORDER.map(day => {
                  const slotClasses = getClassesForSlot(day.key, time);
                  const startingClasses = slotClasses.filter(
                    c => isClassStart(c, day.key, time) && !renderedClasses.has(`${c.id}-${day.key}`)
                  );
                  startingClasses.forEach(c => renderedClasses.add(`${c.id}-${day.key}`));

                  return (
                    <div
                      key={`${day.key}-${time}`}
                      className={cn(
                        "h-4 border-x border-border/30 relative",
                        isFullHour ? "border-b" : "border-b border-dashed border-border/30"
                      )}
                    >
                      {startingClasses.map(cls => {
                        const duration = getClassDuration(cls);
                        const recCount = recCountMap.get(cls.id) || 0;
                        return (
                          <button
                            key={cls.id}
                            onClick={() => onClassClick?.(cls)}
                            className="absolute left-0 right-0 top-0 rounded-sm md:rounded-md p-0.5 md:p-1 text-left text-[8px] md:text-xs font-medium cursor-pointer hover-elevate overflow-hidden"
                            style={{
                              backgroundColor: cls.color,
                              height: `calc(${duration * 100}% + ${(duration - 1) * 1}px)`,
                              zIndex: 10,
                            }}
                            data-testid={`timetable-class-${cls.id}`}
                          >
                            <p className="font-semibold leading-tight break-all line-clamp-2">{cls.name}</p>
                            <p className="text-[7px] md:text-[10px] opacity-80 break-all line-clamp-1">{cls.subject}반</p>
                            <p className="text-[7px] md:text-[10px] opacity-70 hidden md:block">
                              {cls.startTime}-{cls.endTime}
                            </p>
                            {cls.teacherName && (
                              <p className="text-[7px] md:text-[10px] opacity-70 truncate hidden md:block">
                                {cls.teacherName}
                              </p>
                            )}
                            {isStaff && recCount > 0 && (
                              <span
                                className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[8px] flex items-center justify-center font-bold"
                                data-testid={`badge-rec-count-${cls.id}`}
                              >
                                {recCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ClassCard({ cls, onEdit, onDelete, isStaff }: {
  cls: SemesterAnnouncementClass;
  onEdit?: () => void;
  onDelete?: () => void;
  isStaff: boolean;
}) {
  return (
    <Card className="relative overflow-hidden" data-testid={`card-class-${cls.id}`}>
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: cls.color }} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{cls.name} {cls.subject}반</span>
              <Badge variant="outline" className="text-xs">
                {CLASS_LEVEL_LABELS[cls.classLevel] || cls.classLevel}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDays(cls.days, ", ")} {cls.startTime}-{cls.endTime}
              </span>
              {cls.teacherName && (
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  {cls.teacherName}
                </span>
              )}
              {cls.classroom && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {cls.classroom}
                </span>
              )}
            </div>
            {cls.textbook && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                교재: {cls.textbook}
              </div>
            )}
            {cls.notes && (
              <p className="text-sm text-muted-foreground mt-1">{cls.notes}</p>
            )}
          </div>
          {isStaff && (
            <div className="flex gap-1">
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-class-${cls.id}`}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={onDelete} data-testid={`button-delete-class-${cls.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const GRADE_ORDER = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];

const GRADE_LEVEL_MAP: Record<string, string> = {
  "초1": "elementary", "초2": "elementary", "초3": "elementary",
  "초4": "elementary", "초5": "elementary", "초6": "elementary",
  "중1": "middle", "중2": "middle", "중3": "middle",
  "고1": "high", "고2": "high", "고3": "high",
  "성인": "adult",
};

function SemesterEnrollmentStatusTable({
  announcementId,
  announcementClasses,
  recommendations,
  students: allStudents,
  currentUserId,
}: {
  announcementId: string;
  announcementClasses: SemesterAnnouncementClass[];
  recommendations: SemesterRecommendation[];
  students: UserType[];
  currentUserId: string;
}) {
  const [schoolLevel, setSchoolLevel] = useState<"all" | "elementary" | "middle" | "high" | "adult">("middle");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [togglingCell, setTogglingCell] = useState<string | null>(null);
  const { toast } = useToast();

  const teacherNames = useMemo(() => {
    const map = new Map<string, string>();
    announcementClasses.forEach(c => {
      if (c.teacherName) map.set(c.teacherName, c.teacherName);
    });
    return Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "ko"));
  }, [announcementClasses]);

  const activeClasses = useMemo(() => {
    return announcementClasses
      .filter(c => schoolLevel === "all" || c.classLevel === schoolLevel)
      .filter(c => !selectedTeacherId || c.teacherName === selectedTeacherId)
      .sort((a, b) => `${a.name} ${a.subject}`.localeCompare(`${b.name} ${b.subject}`, "ko"));
  }, [announcementClasses, schoolLevel, selectedTeacherId]);

  const recommendedInLevelStudentIds = useMemo(() => {
    if (schoolLevel === "all") return new Set<string>();
    const levelClassIds = new Set(activeClasses.map(c => c.id));
    const ids = new Set<string>();
    recommendations.forEach(r => {
      if (levelClassIds.has(r.announcementClassId)) ids.add(r.studentId);
    });
    return ids;
  }, [activeClasses, recommendations, schoolLevel]);

  const students = useMemo(() => {
    return allStudents
      .filter(u => {
        if (u.role !== UserRole.STUDENT) return false;
        if (schoolLevel === "all") return true;
        const ng = normalizeGrade(u.grade);
        const studentLevel = GRADE_LEVEL_MAP[ng];
        return studentLevel === schoolLevel || recommendedInLevelStudentIds.has(u.id);
      })
      .sort((a, b) => {
        const ag = normalizeGrade(a.grade);
        const bg = normalizeGrade(b.grade);
        const ai = GRADE_ORDER.indexOf(ag);
        const bi = GRADE_ORDER.indexOf(bg);
        const ga = ai !== -1 ? ai : -1;
        const gb = bi !== -1 ? bi : -1;
        if (ga !== gb) return gb - ga;
        return (a.name || "").localeCompare(b.name || "", "ko");
      });
  }, [allStudents, schoolLevel, recommendedInLevelStudentIds]);

  const recommendationMap = useMemo(() => {
    const map = new Map<string, string>();
    recommendations.forEach(r => map.set(`${r.studentId}_${r.announcementClassId}`, r.id));
    return map;
  }, [recommendations]);

  const toggleRecommendation = async (studentId: string, announcementClassId: string) => {
    const key = `${studentId}_${announcementClassId}`;
    setTogglingCell(key);
    try {
      const recId = recommendationMap.get(key);
      if (recId) {
        await apiRequest("DELETE", `/api/semester-recommendations/${recId}?actorId=${currentUserId}`);
        toast({ title: "추천 취소됨" });
      } else {
        await apiRequest("POST", `/api/semester-announcements/${announcementId}/recommendations?actorId=${currentUserId}`, {
          announcementClassId,
          studentId,
        });
        toast({ title: "추천 배정됨" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", announcementId, "recommendations"] });
    } catch (error: any) {
      toast({ title: "오류", description: error?.message || "처리 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setTogglingCell(null);
    }
  };

  const classRecommendCounts = useMemo(() => {
    const counts = new Map<string, number>();
    activeClasses.forEach(c => counts.set(c.id, 0));
    const studentIdSet = new Set(students.map(s => s.id));
    const seen = new Set<string>();
    recommendations.forEach(r => {
      if (!counts.has(r.announcementClassId)) return;
      if (!studentIdSet.has(r.studentId)) return;
      const key = `${r.studentId}_${r.announcementClassId}`;
      if (seen.has(key)) return;
      seen.add(key);
      counts.set(r.announcementClassId, (counts.get(r.announcementClassId) || 0) + 1);
    });
    return counts;
  }, [recommendations, activeClasses, students]);

  const gradeGroups = useMemo(() => {
    const groups: { grade: string; students: UserType[] }[] = [];
    let currentGrade = "";
    let currentStudents: UserType[] = [];
    students.forEach(s => {
      const g = normalizeGrade(s.grade) || "미지정";
      if (g !== currentGrade) {
        if (currentStudents.length > 0) {
          groups.push({ grade: currentGrade, students: currentStudents });
        }
        currentGrade = g;
        currentStudents = [s];
      } else {
        currentStudents.push(s);
      }
    });
    if (currentStudents.length > 0) {
      groups.push({ grade: currentGrade, students: currentStudents });
    }
    return groups;
  }, [students]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              수강과목 현황 (새학기)
            </CardTitle>
            <CardDescription>새학기 안내 시간표 수업 기준 추천 배정 현황</CardDescription>
          </div>
          <Tabs value={schoolLevel} onValueChange={(v) => setSchoolLevel(v as any)}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-sem-enroll-all">전체</TabsTrigger>
              <TabsTrigger value="elementary" data-testid="tab-sem-enroll-elementary">초등</TabsTrigger>
              <TabsTrigger value="middle" data-testid="tab-sem-enroll-middle">중등</TabsTrigger>
              <TabsTrigger value="high" data-testid="tab-sem-enroll-high">고등</TabsTrigger>
              <TabsTrigger value="adult" data-testid="tab-sem-enroll-adult">성인</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {teacherNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <Button
              size="sm"
              variant={selectedTeacherId === null ? "default" : "outline"}
              onClick={() => setSelectedTeacherId(null)}
              className="h-7 text-xs px-2"
              data-testid="button-sem-teacher-filter-all"
            >
              전체
            </Button>
            {teacherNames.map(name => (
              <Button
                key={name}
                size="sm"
                variant={selectedTeacherId === name ? "default" : "outline"}
                onClick={() => setSelectedTeacherId(selectedTeacherId === name ? null : name)}
                className="h-7 text-xs px-2"
                data-testid={`button-sem-teacher-filter-${name}`}
              >
                {name}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      {students.length === 0 ? (
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground py-8">
            해당 학년의 학생이 없습니다
          </div>
        </CardContent>
      ) : (
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[70vh]" data-testid="semester-enrollment-status-table">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-40">
              <tr className="border-b bg-muted">
                <th className="sticky left-0 z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[50px]">학년</th>
                <th className="sticky left-[50px] z-50 bg-muted border-r px-2 py-2 text-center font-medium whitespace-nowrap min-w-[40px]">인원</th>
                <th className="sticky left-[90px] z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[70px]">이름</th>
                <th className="sticky left-[160px] z-50 bg-muted border-r px-2 py-2 text-left font-medium whitespace-nowrap min-w-[70px]">학교</th>
                {activeClasses.map(cls => (
                  <th key={cls.id} className="px-2 py-2 text-center font-medium whitespace-nowrap border-r min-w-[60px] bg-muted">
                    <div className="text-xs leading-tight">
                      <div>{cls.name}</div>
                      <div className="text-muted-foreground">{cls.subject}반</div>
                      {cls.teacherName && <div className="text-muted-foreground font-normal">{cls.teacherName}</div>}
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="border-b font-medium sticky top-[37px] z-40">
                <td className="sticky left-0 z-50 bg-card border-r px-2 py-1.5" colSpan={2}>전체</td>
                <td className="sticky left-[90px] z-50 bg-card border-r px-2 py-1.5 text-center font-bold">{students.length}명</td>
                <td className="sticky left-[160px] z-50 bg-card border-r px-2 py-1.5"></td>
                {activeClasses.map(cls => (
                  <td key={cls.id} className="px-2 py-1.5 text-center border-r font-bold text-primary bg-card">
                    {classRecommendCounts.get(cls.id) || 0}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradeGroups.map(group => (
                group.students.map((student, idx) => {
                  const isNew = student.createdAt && (Date.now() - new Date(student.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;
                  return (
                  <tr key={student.id} className={`border-b hover:bg-muted/30 ${idx === 0 ? "border-t-2 border-t-border" : ""} ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                    {idx === 0 && (
                      <>
                        <td className="sticky left-0 z-20 border-r px-2 py-1.5 font-semibold whitespace-nowrap bg-card" rowSpan={group.students.length}>
                          {group.grade}
                        </td>
                        <td className="sticky left-[50px] z-20 border-r px-2 py-1.5 text-center text-muted-foreground bg-card" rowSpan={group.students.length}>
                          {group.students.length}
                        </td>
                      </>
                    )}
                    <td className={`sticky left-[90px] z-20 border-r px-2 py-1.5 whitespace-nowrap font-medium ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-card"}`}>
                      <span className={isNew ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>{student.name}{isNew && " ●"}</span>
                    </td>
                    <td className={`sticky left-[160px] z-20 border-r px-2 py-1.5 whitespace-nowrap text-muted-foreground text-xs ${isNew ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-card"}`}>
                      {student.school || ""}
                    </td>
                    {activeClasses.map(cls => {
                      const key = `${student.id}_${cls.id}`;
                      const recommended = recommendationMap.has(key);
                      const isToggling = togglingCell === key;
                      return (
                        <td
                          key={cls.id}
                          className={`px-2 py-1.5 text-center border-r cursor-pointer hover:bg-primary/10 transition-colors ${isToggling ? "opacity-50" : ""}`}
                          onClick={() => !isToggling && toggleRecommendation(student.id, cls.id)}
                          data-testid={`cell-sem-enroll-${student.id}-${cls.id}`}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                          ) : recommended ? (
                            <span className="text-primary font-bold">v</span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      )}
    </Card>
  );
}

export default function SemesterAnnouncementsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const isStaff = user && user.role >= UserRole.TEACHER;
  const isStudentOrParent = user && (user.role === UserRole.STUDENT || user.role === UserRole.PARENT);

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SemesterAnnouncement | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showRecommendDialog, setShowRecommendDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyClassSearch, setApplyClassSearch] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState<SemesterAnnouncement | null>(null);
  const [editingClass, setEditingClass] = useState<SemesterAnnouncementClass | null>(null);
  const [activeTab, setActiveTab] = useState("timetable");

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const [className, setClassName] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [classLevel, setClassLevel] = useState("middle");
  const [classTeacher, setClassTeacher] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [classRoom, setClassRoom] = useState("");
  const [classDays, setClassDays] = useState<string[]>([]);
  const [classStartTime, setClassStartTime] = useState("14:00");
  const [classEndTime, setClassEndTime] = useState("16:00");
  const [classColor, setClassColor] = useState("#3B82F6");
  const [classTextbook, setClassTextbook] = useState("");
  const [classNotes, setClassNotes] = useState("");

  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [recommendClassId, setRecommendClassId] = useState("");
  const [recommendNotes, setRecommendNotes] = useState("");
  const [recommendStudentSearch, setRecommendStudentSearch] = useState("");
  const [selectedTimetableClass, setSelectedTimetableClass] = useState<SemesterAnnouncementClass | null>(null);
  const [timetableStudentSearch, setTimetableStudentSearch] = useState("");
  const [timetableGradeFilter, setTimetableGradeFilter] = useState<string | null>(null);
  const [editingRecommendation, setEditingRecommendation] = useState<SemesterRecommendation | null>(null);
  const [editRecClassId, setEditRecClassId] = useState("");
  const [editRecNotes, setEditRecNotes] = useState("");
  const [recommendGradeFilter, setRecommendGradeFilter] = useState<string | null>(null);

  const centerId = selectedCenter?.id;

  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery<SemesterAnnouncement[]>({
    queryKey: ["/api/semester-announcements", centerId, user?.id],
    queryFn: () => fetch(`/api/semester-announcements?centerId=${centerId}&actorId=${user?.id}`).then(r => r.json()),
    enabled: !!centerId && !!user,
  });

  const { data: announcementClasses = [], isLoading: loadingClasses } = useQuery<SemesterAnnouncementClass[]>({
    queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "classes"],
    queryFn: () => fetch(`/api/semester-announcements/${selectedAnnouncement?.id}/classes`).then(r => r.json()),
    enabled: !!selectedAnnouncement?.id,
  });

  const { data: recommendations = [] } = useQuery<SemesterRecommendation[]>({
    queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"],
    queryFn: () => fetch(`/api/semester-announcements/${selectedAnnouncement?.id}/recommendations`).then(r => r.json()),
    enabled: !!selectedAnnouncement?.id,
  });

  const { data: applications = [] } = useQuery<SemesterApplication[]>({
    queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "applications", user?.id],
    queryFn: () => fetch(`/api/semester-announcements/${selectedAnnouncement?.id}/applications?actorId=${user?.id}`).then(r => r.json()),
    enabled: !!selectedAnnouncement?.id && !!user,
  });

  const { data: students = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users", centerId],
    queryFn: () => fetch(`/api/users?centerId=${centerId}`).then(r => r.json()),
    enabled: !!centerId && !!isStaff,
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", centerId],
    queryFn: () => fetch(`/api/enrollments?centerId=${centerId}`).then(r => r.json()),
    enabled: !!centerId && !!isStaff,
  });

  const { data: teachers = [] } = useQuery<UserType[]>({
    queryKey: [`/api/centers/${centerId}/teachers`],
    enabled: !!centerId,
  });

  const teacherMap = useMemo(() =>
    new Map(teachers.map((t) => [t.id, t])),
    [teachers]
  );

  const filteredAnnouncementClasses = useMemo(() => {
    if (selectedTeacherFilter === "all") return announcementClasses;
    return announcementClasses.filter(cls => cls.teacherId === selectedTeacherFilter);
  }, [announcementClasses, selectedTeacherFilter]);

  const hasTeacherAssigned = useMemo(() =>
    announcementClasses.some(cls => cls.teacherId),
    [announcementClasses]
  );

  const studentUsers = useMemo(() => (students as UserType[]).filter((s: UserType) => s.role === UserRole.STUDENT), [students]);

  const studentUserMap = useMemo(() => new Map(studentUsers.map(s => [s.id, s])), [studentUsers]);

  const announcementClassMap = useMemo(() => new Map(announcementClasses.map(c => [c.id, c])), [announcementClasses]);

  const recommendedKeySet = useMemo(
    () => new Set(recommendations.map(r => `${r.studentId}_${r.announcementClassId}`)),
    [recommendations]
  );

  const selectedStudentSet = useMemo(() => new Set(selectedStudents), [selectedStudents]);

  const recommendDialogStudents = useMemo(() => {
    const search = recommendStudentSearch.toLowerCase();
    return studentUsers.filter(s => {
      if (recommendGradeFilter && normalizeGrade(s.grade) !== recommendGradeFilter) return false;
      if (search && !s.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [studentUsers, recommendGradeFilter, recommendStudentSearch]);

  const groupedRecommendationRows = useMemo(() => {
    const grouped = new Map<string, Map<string, { rec?: SemesterRecommendation; appId?: string }>>();
    recommendations.forEach(rec => {
      if (!grouped.has(rec.studentId)) grouped.set(rec.studentId, new Map());
      const cm = grouped.get(rec.studentId)!;
      cm.set(rec.announcementClassId, { ...(cm.get(rec.announcementClassId) || {}), rec });
    });
    applications.forEach(app => {
      if (!grouped.has(app.studentId)) grouped.set(app.studentId, new Map());
      const cm = grouped.get(app.studentId)!;
      cm.set(app.announcementClassId, { ...(cm.get(app.announcementClassId) || {}), appId: app.id });
    });
    return Array.from(grouped.entries())
      .filter(([studentId]) => {
        if (!recommendGradeFilter) return true;
        const student = studentUserMap.get(studentId);
        return normalizeGrade(student?.grade) === recommendGradeFilter;
      })
      .map(([studentId, classMap]) => {
        const student = studentUserMap.get(studentId);
        const rows = Array.from(classMap.entries())
          .map(([classId, status]) => ({ classId, ...status }))
          .sort((a, b) => compareByClassDay(
            announcementClassMap.get(a.classId),
            announcementClassMap.get(b.classId)
          ));
        return { studentId, student, rows };
      });
  }, [recommendations, applications, recommendGradeFilter, studentUserMap, announcementClassMap]);

  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    studentUsers.forEach(s => { const g = normalizeGrade(s.grade); if (g) grades.add(g); });
    const gradeOrder = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];
    return Array.from(grades).sort((a, b) => {
      const ai = gradeOrder.indexOf(a);
      const bi = gradeOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [studentUsers]);

  const myRecommendations = useMemo(() => {
    if (!user || !isStudentOrParent) return [];
    const studentId = user.role === UserRole.PARENT ? user.linkedStudentIds?.[0] : user.id;
    if (!studentId) return [];
    return recommendations.filter(r => r.studentId === studentId);
  }, [user, isStudentOrParent, recommendations]);

  const myRecommendedClasses = useMemo(() => {
    return myRecommendations.map(rec => {
      const cls = announcementClasses.find(c => c.id === rec.announcementClassId);
      return { recommendation: rec, class: cls };
    }).filter(item => item.class)
      .sort((a, b) => compareByClassDay(a.class, b.class));
  }, [myRecommendations, announcementClasses]);

  const myStudentId = useMemo(() => {
    if (!user || !isStudentOrParent) return undefined;
    return user.role === UserRole.PARENT ? user.linkedStudentIds?.[0] : user.id;
  }, [user, isStudentOrParent]);

  const myApplications = useMemo(() => {
    if (!myStudentId) return [];
    return applications.filter(a => a.studentId === myStudentId);
  }, [applications, myStudentId]);

  // 내가 신청한 수업: announcementClassId -> applicationId
  const myApplicationMap = useMemo(() => {
    return new Map(myApplications.map(a => [a.announcementClassId, a.id]));
  }, [myApplications]);

  // 추천받은 수업 외에 추가로 신청한 수업 목록
  const myExtraApplications = useMemo(() => {
    const recommendedClassIds = new Set(myRecommendations.map(r => r.announcementClassId));
    return myApplications
      .filter(a => !recommendedClassIds.has(a.announcementClassId))
      .map(a => ({ application: a, class: announcementClasses.find(c => c.id === a.announcementClassId) }))
      .filter(item => item.class)
      .sort((a, b) => compareByClassDay(a.class, b.class));
  }, [myApplications, myRecommendations, announcementClasses]);

  // 추천 외 추가 신청 가능한 수업 (추천받지 않았고 아직 신청하지 않은 수업)
  const applyableClasses = useMemo(() => {
    const recommendedClassIds = new Set(myRecommendations.map(r => r.announcementClassId));
    const appliedClassIds = new Set(myApplications.map(a => a.announcementClassId));
    return announcementClasses
      .filter(c => !recommendedClassIds.has(c.id) && !appliedClassIds.has(c.id))
      .sort((a, b) => compareByClassDay(a, b));
  }, [announcementClasses, myRecommendations, myApplications]);

  const visibleAnnouncements = useMemo(() => {
    if (isStaff) return announcements;
    return announcements.filter(a => a.status === "published");
  }, [announcements, isStaff]);

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const res = await apiRequest("POST", `/api/semester-announcements?actorId=${user?.id}`, {
        ...data,
        centerId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements"] });
      toast({ title: "새 학기 안내가 생성되었습니다" });
      setShowCreateDialog(false);
      setFormTitle("");
      setFormDescription("");
    },
    onError: () => toast({ title: "생성에 실패했습니다", variant: "destructive" }),
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/semester-announcements/${id}?actorId=${user?.id}`, data);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements"] });
      setSelectedAnnouncement(result);
      toast({ title: "안내가 업데이트되었습니다" });
      setEditingAnnouncement(null);
    },
    onError: () => toast({ title: "업데이트에 실패했습니다", variant: "destructive" }),
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/semester-announcements/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements"] });
      setSelectedAnnouncement(null);
      toast({ title: "안내가 삭제되었습니다" });
    },
    onError: () => toast({ title: "삭제에 실패했습니다", variant: "destructive" }),
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/semester-announcements/${selectedAnnouncement?.id}/classes?actorId=${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "classes"] });
      toast({ title: "수업이 추가되었습니다" });
      setShowClassDialog(false);
      resetClassForm();
    },
    onError: () => toast({ title: "수업 추가에 실패했습니다", variant: "destructive" }),
  });

  const importCurrentClassesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/semester-announcements/${selectedAnnouncement?.id}/import-current-classes?actorId=${user?.id}`, {});
      return res.json();
    },
    onSuccess: (result: { classesAdded: number; recommendationsAdded: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"] });
      setShowImportConfirm(false);
      toast({
        title: "현재 시간표를 불러왔습니다",
        description: `수업 ${result.classesAdded}개, 학생 배정 ${result.recommendationsAdded}건이 추가되었습니다`,
      });
    },
    onError: () => toast({ title: "불러오기에 실패했습니다", variant: "destructive" }),
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/semester-announcement-classes/${id}?actorId=${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "classes"] });
      toast({ title: "수업이 수정되었습니다" });
      setShowClassDialog(false);
      setEditingClass(null);
      resetClassForm();
    },
    onError: () => toast({ title: "수업 수정에 실패했습니다", variant: "destructive" }),
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/semester-announcement-classes/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"] });
      toast({ title: "수업이 삭제되었습니다" });
    },
    onError: () => toast({ title: "삭제에 실패했습니다", variant: "destructive" }),
  });

  const createRecommendationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/semester-announcements/${selectedAnnouncement?.id}/recommendations/bulk?actorId=${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"] });
      toast({ title: "추천 수업이 배정되었습니다" });
      setShowRecommendDialog(false);
      setSelectedStudents([]);
      setRecommendClassId("");
      setRecommendNotes("");
      setRecommendStudentSearch("");
    },
    onError: () => toast({ title: "추천 배정에 실패했습니다", variant: "destructive" }),
  });

  const updateRecommendationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { announcementClassId?: string; notes?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/semester-recommendations/${id}?actorId=${user?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"] });
      toast({ title: "추천이 수정되었습니다" });
      setEditingRecommendation(null);
    },
    onError: () => toast({ title: "수정에 실패했습니다", variant: "destructive" }),
  });

  const deleteRecommendationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/semester-recommendations/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "recommendations"] });
      toast({ title: "추천이 삭제되었습니다" });
    },
    onError: () => toast({ title: "삭제에 실패했습니다", variant: "destructive" }),
  });

  const createApplicationMutation = useMutation({
    mutationFn: async ({ announcementClassId, studentId }: { announcementClassId: string; studentId: string }) => {
      const res = await apiRequest("POST", `/api/semester-announcements/${selectedAnnouncement?.id}/applications?actorId=${user?.id}`, {
        announcementClassId,
        studentId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "applications"] });
      toast({ title: "수업을 신청했습니다" });
      setShowApplyDialog(false);
    },
    onError: () => toast({ title: "신청에 실패했습니다", variant: "destructive" }),
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/semester-applications/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/semester-announcements", selectedAnnouncement?.id, "applications"] });
      toast({ title: "신청을 취소했습니다" });
    },
    onError: () => toast({ title: "취소에 실패했습니다", variant: "destructive" }),
  });

  function resetClassForm() {
    setClassName("");
    setClassSubject("");
    setClassLevel("middle");
    setClassTeacher("");
    setClassTeacherId("");
    setClassRoom("");
    setClassDays([]);
    setClassStartTime("14:00");
    setClassEndTime("16:00");
    setClassColor("#3B82F6");
    setClassTextbook("");
    setClassNotes("");
  }

  function openEditClass(cls: SemesterAnnouncementClass) {
    setEditingClass(cls);
    setClassName(cls.name);
    setClassSubject(cls.subject);
    setClassLevel(cls.classLevel);
    setClassTeacher(cls.teacherName || "");
    setClassTeacherId(cls.teacherId || "");
    setClassRoom(cls.classroom || "");
    setClassDays(cls.days);
    setClassStartTime(cls.startTime);
    setClassEndTime(cls.endTime);
    setClassColor(cls.color);
    setClassTextbook(cls.textbook || "");
    setClassNotes(cls.notes || "");
    setShowClassDialog(true);
  }

  function handleSaveClass() {
    const data = {
      name: className,
      subject: classSubject,
      classLevel,
      teacherName: classTeacher || null,
      teacherId: classTeacherId || null,
      classroom: classRoom || null,
      days: classDays,
      startTime: classStartTime,
      endTime: classEndTime,
      color: classColor,
      textbook: classTextbook || null,
      notes: classNotes || null,
      sortOrder: editingClass ? editingClass.sortOrder : announcementClasses.length,
    };
    if (!className || !classSubject || classDays.length === 0) {
      toast({ title: "수업명, 반이름, 수업 요일을 입력해주세요", variant: "destructive" });
      return;
    }
    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data });
    } else {
      createClassMutation.mutate(data);
    }
  }

  if (!centerId) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-no-center">
        센터를 선택해주세요
      </div>
    );
  }

  if (loadingAnnouncements) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (selectedAnnouncement) {
    const statusInfo = STATUS_LABELS[selectedAnnouncement.status] || STATUS_LABELS.draft;
    const isDraft = selectedAnnouncement.status === "draft";
    const isEditable = !!isStaff;

    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" data-testid="announcement-detail">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedAnnouncement(null)}
            data-testid="button-back"
          >
            ← 목록으로
          </Button>
          <Badge variant={statusInfo.variant} data-testid="badge-status">
            {statusInfo.label}
          </Badge>
          {isStaff && isDraft && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => updateAnnouncementMutation.mutate({
                  id: selectedAnnouncement.id,
                  data: { status: "published" }
                })}
                data-testid="button-publish"
              >
                <Send className="h-4 w-4 mr-1" />
                게시하기
              </Button>
            </>
          )}
          {isStaff && selectedAnnouncement.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateAnnouncementMutation.mutate({
                id: selectedAnnouncement.id,
                data: { status: "archived" }
              })}
              data-testid="button-archive"
            >
              <Archive className="h-4 w-4 mr-1" />
              보관
            </Button>
          )}
          {isStaff && selectedAnnouncement.status === "archived" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => updateAnnouncementMutation.mutate({
                id: selectedAnnouncement.id,
                data: { status: "published" }
              })}
              data-testid="button-republish"
            >
              <Send className="h-4 w-4 mr-1" />
              다시 게시
            </Button>
          )}
          {isStaff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingAnnouncement(selectedAnnouncement);
                setFormTitle(selectedAnnouncement.title);
                setFormDescription(selectedAnnouncement.description || "");
              }}
              data-testid="button-edit-announcement"
            >
              <Edit className="h-4 w-4 mr-1" />
              수정
            </Button>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold" data-testid="text-announcement-title">
            {selectedAnnouncement.title}
          </h1>
          {selectedAnnouncement.description && (
            <p className="text-muted-foreground mt-2" data-testid="text-announcement-description">
              {selectedAnnouncement.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {selectedAnnouncement.createdAt && format(new Date(selectedAnnouncement.createdAt), "yyyy년 M월 d일", { locale: ko })}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-announcement">
            <TabsTrigger value="timetable" data-testid="tab-timetable">
              <Calendar className="h-4 w-4 mr-1" />
              시간표
            </TabsTrigger>
            {isStaff && (
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">
                <GraduationCap className="h-4 w-4 mr-1" />
                추천 배정
              </TabsTrigger>
            )}
            {isStudentOrParent && (
              <TabsTrigger value="my-recommendations" data-testid="tab-my-recommendations">
                <GraduationCap className="h-4 w-4 mr-1" />
                수업 신청
              </TabsTrigger>
            )}
            {isStaff && (
              <TabsTrigger value="enrollment-status" data-testid="tab-enrollment-status">
                <BookOpen className="h-4 w-4 mr-1" />
                수강과목 현황
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="timetable" className="mt-4">
            {teachers.length > 0 && hasTeacherAssigned && (
              <Tabs value={selectedTeacherFilter} onValueChange={setSelectedTeacherFilter} className="mb-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="all" data-testid="tab-sem-teacher-all">
                    전체
                  </TabsTrigger>
                  {teachers.map((t) => (
                    <TabsTrigger key={t.id} value={t.id} data-testid={`tab-sem-teacher-${t.id}`}>
                      {t.name} 선생님
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">새 학기 시간표</CardTitle>
                    <CardDescription>
                      {isStaff ? "수업을 클릭하여 학생을 추천 배정할 수 있습니다" : "전체 수업 시간표를 확인하세요"}
                    </CardDescription>
                  </div>
                  {isEditable && (
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Button
                        onClick={() => setShowImportConfirm(true)}
                        size="sm"
                        variant="outline"
                        data-testid="button-import-current-classes"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        현재 시간표 불러오기
                      </Button>
                      <Button
                        onClick={() => {
                          resetClassForm();
                          setEditingClass(null);
                          setShowClassDialog(true);
                        }}
                        size="sm"
                        data-testid="button-add-class-timetable"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        수업 추가
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingClasses ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <InteractiveTimetableGrid
                    classes={filteredAnnouncementClasses}
                    onClassClick={(cls) => {
                      setSelectedTimetableClass(cls);
                      setTimetableStudentSearch("");
                    }}
                    recommendations={recommendations}
                    isStaff={!!isStaff}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {isStaff && (
            <TabsContent value="recommendations" className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold min-w-0">학생별 추천 수업 배정</h3>
                {isEditable && (
                  <Button
                    onClick={() => setShowRecommendDialog(true)}
                    disabled={announcementClasses.length === 0}
                    className="shrink-0"
                    data-testid="button-add-recommendation"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    추천 배정
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={recommendGradeFilter === null ? "default" : "outline"}
                  onClick={() => setRecommendGradeFilter(null)}
                  data-testid="button-rec-tab-grade-all"
                >
                  전체
                </Button>
                {availableGrades.map(grade => (
                  <Button
                    key={grade}
                    size="sm"
                    variant={recommendGradeFilter === grade ? "default" : "outline"}
                    onClick={() => setRecommendGradeFilter(recommendGradeFilter === grade ? null : grade)}
                    data-testid={`button-rec-tab-grade-${grade}`}
                  >
                    {grade}
                  </Button>
                ))}
              </div>

              {recommendations.length === 0 && applications.length === 0 ? (
                <div className="text-center text-muted-foreground py-12" data-testid="text-no-recommendations">
                  추천 배정 및 신청 내역이 없습니다
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedRecommendationRows.map(({ studentId, student, rows }) => {
                      return (
                        <Card key={studentId} data-testid={`card-student-recommendations-${studentId}`}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <UserIcon className="h-4 w-4" />
                              {student?.name || "알 수 없는 학생"}
                              {student?.grade && (
                                <Badge variant="outline" className="text-xs">
                                  {normalizeGrade(student.grade)}
                                </Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="py-2 space-y-1">
                            {rows.map(({ classId, rec, appId }) => {
                              const cls = announcementClassMap.get(classId);
                              return (
                                <div key={classId} className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid={`row-student-class-${studentId}-${classId}`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: cls?.color || "#ccc" }}
                                    />
                                    <span className="text-sm truncate">{cls ? `${cls.name} ${cls.subject}반` : "삭제된 수업"}</span>
                                    {rec && (
                                      <Badge variant="secondary" className="text-xs flex-shrink-0" data-testid={`badge-rec-${studentId}-${classId}`}>추천</Badge>
                                    )}
                                    {appId && (
                                      <Badge className="text-xs flex-shrink-0 bg-green-600 hover:bg-green-600" data-testid={`badge-app-${studentId}-${classId}`}>신청</Badge>
                                    )}
                                    {cls && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        {formatDays(cls.days)} {cls.startTime}-{cls.endTime}
                                      </span>
                                    )}
                                    {cls && (cls.teacherName || (cls.teacherId && teacherMap.get(cls.teacherId)?.name)) && (
                                      <span className="text-xs text-muted-foreground truncate">
                                        담당: {cls.teacherName || teacherMap.get(cls.teacherId!)?.name}
                                      </span>
                                    )}
                                    {rec?.notes && (
                                      <span className="text-xs text-muted-foreground truncate">추천사유: {rec.notes}</span>
                                    )}
                                  </div>
                                  {isEditable && rec && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setEditingRecommendation(rec);
                                          setEditRecClassId(rec.announcementClassId);
                                          setEditRecNotes(rec.notes || "");
                                        }}
                                        data-testid={`button-edit-rec-${rec.id}`}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          if (confirm("이 추천 배정을 삭제하시겠습니까?")) {
                                            deleteRecommendationMutation.mutate(rec.id);
                                          }
                                        }}
                                        data-testid={`button-delete-rec-${rec.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </TabsContent>
          )}

          {isStudentOrParent && (
            <TabsContent value="my-recommendations" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    추천 수업
                  </CardTitle>
                  <CardDescription>
                    선생님이 추천해 주신 수업입니다. 신청 버튼을 눌러 수강 의사를 표시할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myRecommendedClasses.length === 0 ? (
                    <div className="text-center text-muted-foreground py-6" data-testid="text-no-my-recommendations">
                      추천받은 수업이 없습니다
                    </div>
                  ) : (
                    myRecommendedClasses.map(({ recommendation, class: cls }) => {
                      const appId = cls ? myApplicationMap.get(cls.id) : undefined;
                      const isApplied = !!appId;
                      return (
                        <div key={recommendation.id} className="flex flex-col gap-3 p-3 rounded-lg bg-muted/50 sm:flex-row sm:items-start" data-testid={`row-my-rec-${recommendation.id}`}>
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: cls?.color || "#ccc" }}
                            />
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="font-medium flex flex-wrap items-center gap-2">
                                <span className="break-keep">{cls?.name} {cls?.subject}반</span>
                                {isApplied && (
                                  <Badge className="text-xs bg-green-600 hover:bg-green-600 flex-shrink-0" data-testid={`badge-applied-${cls?.id}`}>신청완료</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                                <span>{formatDays(cls?.days, ", ")} {cls?.startTime}-{cls?.endTime}</span>
                                {cls?.teacherName && <span>• {cls.teacherName} 선생님</span>}
                              </div>
                              {recommendation.notes && (
                                <p className="text-sm text-muted-foreground break-keep">추천사유: {recommendation.notes}</p>
                              )}
                            </div>
                          </div>
                          {cls && myStudentId && (
                            isApplied ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full shrink-0 sm:w-auto"
                                disabled={deleteApplicationMutation.isPending}
                                onClick={() => deleteApplicationMutation.mutate(appId!)}
                                data-testid={`button-cancel-application-${cls.id}`}
                              >
                                <X className="h-4 w-4 mr-1" />
                                신청취소
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full shrink-0 sm:w-auto"
                                disabled={createApplicationMutation.isPending}
                                onClick={() => createApplicationMutation.mutate({ announcementClassId: cls.id, studentId: myStudentId })}
                                data-testid={`button-apply-${cls.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                신청
                              </Button>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        추가 신청 수업
                      </CardTitle>
                      <CardDescription>추천 외 다른 수업도 직접 신청할 수 있습니다</CardDescription>
                    </div>
                    {myStudentId && (
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={applyableClasses.length === 0}
                        onClick={() => { setApplyClassSearch(""); setShowApplyDialog(true); }}
                        data-testid="button-open-apply-dialog"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        수업 추가하기
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myExtraApplications.length === 0 ? (
                    <div className="text-center text-muted-foreground py-6" data-testid="text-no-extra-applications">
                      추가로 신청한 수업이 없습니다
                    </div>
                  ) : (
                    myExtraApplications.map(({ application, class: cls }) => (
                      <div key={application.id} className="flex flex-col gap-3 p-3 rounded-lg bg-muted/50 sm:flex-row sm:items-start" data-testid={`row-extra-app-${application.id}`}>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: cls?.color || "#ccc" }}
                          />
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="font-medium flex flex-wrap items-center gap-2">
                              <span className="break-keep">{cls?.name} {cls?.subject}반</span>
                              <Badge className="text-xs bg-green-600 hover:bg-green-600 flex-shrink-0">신청완료</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>{formatDays(cls?.days, ", ")} {cls?.startTime}-{cls?.endTime}</span>
                              {cls?.teacherName && <span>• {cls.teacherName} 선생님</span>}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full shrink-0 sm:w-auto"
                          disabled={deleteApplicationMutation.isPending}
                          onClick={() => deleteApplicationMutation.mutate(application.id)}
                          data-testid={`button-cancel-extra-application-${application.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          신청취소
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isStaff && centerId && (
            <TabsContent value="enrollment-status" className="mt-4">
              <SemesterEnrollmentStatusTable
                announcementId={selectedAnnouncement.id}
                announcementClasses={announcementClasses}
                recommendations={recommendations}
                students={students}
                currentUserId={user?.id || ""}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Edit Announcement Dialog */}
        <Dialog open={!!editingAnnouncement} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>안내 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>제목</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label>설명 (선택)</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  data-testid="input-edit-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!editingAnnouncement) return;
                  updateAnnouncementMutation.mutate({
                    id: editingAnnouncement.id,
                    data: { title: formTitle, description: formDescription || null },
                  });
                }}
                disabled={!formTitle}
                data-testid="button-save-edit"
              >
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Class Dialog */}
        <Dialog open={showClassDialog} onOpenChange={(open) => {
          if (!open) {
            setShowClassDialog(false);
            setEditingClass(null);
            resetClassForm();
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClass ? "수업 수정" : "수업 추가"}</DialogTitle>
              <DialogDescription>새 학기 시간표에 표시될 수업 정보를 입력하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>수업명 *</Label>
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="예: 중2-2"
                    data-testid="input-class-name"
                  />
                </div>
                <div>
                  <Label>반이름 *</Label>
                  <Input
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    placeholder="예: 화목S"
                    data-testid="input-class-subject"
                  />
                </div>
              </div>
              <div>
                <Label>학년군</Label>
                <Select value={classLevel} onValueChange={setClassLevel}>
                  <SelectTrigger data-testid="select-class-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elementary">초등</SelectItem>
                    <SelectItem value="middle">중등</SelectItem>
                    <SelectItem value="high">고등</SelectItem>
                    <SelectItem value="all">전체</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>담당 선생님</Label>
                  <Select
                    value={classTeacherId || "_none"}
                    onValueChange={(v) => {
                      if (v === "_none") {
                        setClassTeacherId("");
                        setClassTeacher("");
                      } else {
                        setClassTeacherId(v);
                        const teacher = teachers.find(t => t.id === v);
                        setClassTeacher(teacher?.name || "");
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-class-teacher">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">선택 안함</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} 선생님
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>교실</Label>
                  <Input
                    value={classRoom}
                    onChange={(e) => setClassRoom(e.target.value)}
                    placeholder="예: 301호"
                    data-testid="input-class-room"
                  />
                </div>
              </div>
              <div>
                <Label>수업 요일 *</Label>
                <div className="flex gap-2 mt-1">
                  {Object.entries(DAY_LABELS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={classDays.includes(key) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setClassDays(prev =>
                          prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
                        );
                      }}
                      data-testid={`button-day-${key}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>시작 시간 *</Label>
                  <Input
                    type="time"
                    value={classStartTime}
                    onChange={(e) => setClassStartTime(e.target.value)}
                    data-testid="input-class-start-time"
                  />
                </div>
                <div>
                  <Label>종료 시간 *</Label>
                  <Input
                    type="time"
                    value={classEndTime}
                    onChange={(e) => setClassEndTime(e.target.value)}
                    data-testid="input-class-end-time"
                  />
                </div>
              </div>
              <div>
                <Label>색상</Label>
                <div className="flex gap-2 mt-1">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-transform",
                        classColor === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setClassColor(color)}
                      data-testid={`button-color-${color}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>교재</Label>
                <Input
                  value={classTextbook}
                  onChange={(e) => setClassTextbook(e.target.value)}
                  placeholder="사용 교재명"
                  data-testid="input-class-textbook"
                />
              </div>
              <div>
                <Label>비고</Label>
                <Textarea
                  value={classNotes}
                  onChange={(e) => setClassNotes(e.target.value)}
                  placeholder="추가 안내사항"
                  data-testid="input-class-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSaveClass}
                disabled={createClassMutation.isPending || updateClassMutation.isPending}
                data-testid="button-save-class"
              >
                {editingClass ? "수정" : "추가"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Current Timetable Confirm Dialog */}
        <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>현재 시간표 불러오기</DialogTitle>
              <DialogDescription>
                현재 운영 중인 시간표의 수업과 각 수업에 수강 중인 학생을 이 새학기 안내로 복사합니다.
                복사된 학생은 추천 배정으로 등록되며, 이미 동일하게 추가된 항목은 중복되지 않습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowImportConfirm(false)}
                disabled={importCurrentClassesMutation.isPending}
                data-testid="button-import-cancel"
              >
                취소
              </Button>
              <Button
                onClick={() => importCurrentClassesMutation.mutate()}
                disabled={importCurrentClassesMutation.isPending}
                data-testid="button-import-confirm"
              >
                {importCurrentClassesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    불러오는 중...
                  </>
                ) : (
                  "불러오기"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Timetable Class Detail Dialog */}
        <Dialog open={!!selectedTimetableClass} onOpenChange={(open) => { if (!open) setSelectedTimetableClass(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {selectedTimetableClass && (() => {
              const cls = selectedTimetableClass;
              const classRecommendations = recommendations.filter(r => r.announcementClassId === cls.id);
              const recommendedStudentIds = new Set(classRecommendations.map(r => r.studentId));
              const filteredStudentsForClass = studentUsers.filter(s => {
                if (recommendedStudentIds.has(s.id)) return false;
                if (timetableGradeFilter && normalizeGrade(s.grade) !== timetableGradeFilter) return false;
                if (timetableStudentSearch && !s.name.toLowerCase().includes(timetableStudentSearch.toLowerCase())) return false;
                return true;
              });

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="w-3 h-8 rounded-full" style={{ backgroundColor: cls.color }} />
                      {cls.name} {cls.subject}반
                    </DialogTitle>
                    <DialogDescription>
                      {formatDays(cls.days, ", ")} {cls.startTime}-{cls.endTime}
                      {cls.teacherName && ` | ${cls.teacherName}`}
                      {cls.classroom && ` | ${cls.classroom}`}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">학년군</span>
                        <Badge variant="outline">{CLASS_LEVEL_LABELS[cls.classLevel] || cls.classLevel}</Badge>
                      </div>
                      {cls.textbook && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">교재</span>
                          <span>{cls.textbook}</span>
                        </div>
                      )}
                      {cls.notes && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">비고</span>
                          <span>{cls.notes}</span>
                        </div>
                      )}
                    </div>

                    {isStaff && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">배정된 학생 ({classRecommendations.length}명)</Label>
                          </div>
                          {classRecommendations.length > 0 ? (
                            <div className="border rounded-md p-2">
                              <div className="space-y-1">
                                {classRecommendations.map(rec => {
                                  const student = studentUserMap.get(rec.studentId);
                                  return (
                                    <div key={rec.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">{student?.name || "알 수 없음"}</span>
                                        {student?.grade && <span className="text-xs text-muted-foreground">{normalizeGrade(student.grade)}</span>}
                                        {rec.notes && <span className="text-xs text-muted-foreground">추천사유: {rec.notes}</span>}
                                      </div>
                                      {isEditable && (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => deleteRecommendationMutation.mutate(rec.id)}
                                          disabled={deleteRecommendationMutation.isPending}
                                          data-testid={`button-remove-rec-${rec.id}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">배정된 학생이 없습니다</p>
                          )}

                          {isEditable && (
                            <>
                              <Separator />
                              <div className="space-y-2">
                                <Label className="text-sm font-semibold">학생 추가</Label>
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    size="sm"
                                    variant={timetableGradeFilter === null ? "default" : "outline"}
                                    onClick={() => setTimetableGradeFilter(null)}
                                    data-testid="button-tt-grade-all"
                                  >
                                    전체
                                  </Button>
                                  {availableGrades.map(grade => (
                                    <Button
                                      key={grade}
                                      size="sm"
                                      variant={timetableGradeFilter === grade ? "default" : "outline"}
                                      onClick={() => setTimetableGradeFilter(timetableGradeFilter === grade ? null : grade)}
                                      data-testid={`button-tt-grade-${grade}`}
                                    >
                                      {grade}
                                    </Button>
                                  ))}
                                </div>
                                <Input
                                  placeholder="학생 이름 검색..."
                                  value={timetableStudentSearch}
                                  onChange={(e) => setTimetableStudentSearch(e.target.value)}
                                  data-testid="input-timetable-student-search"
                                />
                                <div className="max-h-72 overflow-y-auto overscroll-contain border rounded-md p-2">
                                  <div className="space-y-1">
                                    {filteredStudentsForClass.map(student => (
                                      <div key={student.id} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                                        <div>
                                          <span className="text-sm font-medium">{student.name}</span>
                                          {student.grade && <span className="text-xs text-muted-foreground ml-2">{normalizeGrade(student.grade)}</span>}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            createRecommendationMutation.mutate({
                                              studentIds: [student.id],
                                              announcementClassId: cls.id,
                                              notes: null,
                                            });
                                          }}
                                          disabled={createRecommendationMutation.isPending}
                                          data-testid={`button-add-student-${student.id}`}
                                        >
                                          <UserPlus className="h-3 w-3 mr-1" />
                                          추가
                                        </Button>
                                      </div>
                                    ))}
                                    {filteredStudentsForClass.length === 0 && (
                                      <p className="text-sm text-muted-foreground text-center py-3">
                                        {timetableStudentSearch ? "검색 결과가 없습니다" : "모든 학생이 배정되었습니다"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {isEditable && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            openEditClass(cls);
                            setSelectedTimetableClass(null);
                          }}
                          data-testid="button-edit-class-from-timetable"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          수업 수정
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("이 수업을 삭제하시겠습니까?")) {
                              deleteClassMutation.mutate(cls.id);
                              setSelectedTimetableClass(null);
                            }
                          }}
                          data-testid="button-delete-class-from-timetable"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          삭제
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Recommend Dialog */}
        <Dialog open={showRecommendDialog} onOpenChange={setShowRecommendDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>추천 수업 배정</DialogTitle>
              <DialogDescription>학생에게 추천할 수업을 선택하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>추천 수업 *</Label>
                <Select value={recommendClassId} onValueChange={setRecommendClassId}>
                  <SelectTrigger data-testid="select-recommend-class">
                    <SelectValue placeholder="수업 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {announcementClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.subject}반
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>학생 선택 *</Label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  <Button
                    size="sm"
                    variant={recommendGradeFilter === null ? "default" : "outline"}
                    onClick={() => setRecommendGradeFilter(null)}
                    data-testid="button-grade-all"
                  >
                    전체
                  </Button>
                  {availableGrades.map(grade => (
                    <Button
                      key={grade}
                      size="sm"
                      variant={recommendGradeFilter === grade ? "default" : "outline"}
                      onClick={() => setRecommendGradeFilter(recommendGradeFilter === grade ? null : grade)}
                      data-testid={`button-grade-${grade}`}
                    >
                      {grade}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="학생 이름 검색..."
                  value={recommendStudentSearch}
                  onChange={(e) => setRecommendStudentSearch(e.target.value)}
                  data-testid="input-recommend-student-search"
                />
                <ScrollArea className="h-48 border rounded-md p-2 mt-2">
                  {studentUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">학생이 없습니다</p>
                  ) : recommendDialogStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다</p>
                  ) : (
                    recommendDialogStudents.map(student => {
                      const alreadyRecommended = recommendedKeySet.has(`${student.id}_${recommendClassId}`);
                      return (
                        <div
                          key={student.id}
                          className="flex items-center gap-2 py-1.5 px-1"
                        >
                          <Checkbox
                            checked={selectedStudentSet.has(student.id)}
                            onCheckedChange={(checked) => {
                              setSelectedStudents(prev =>
                                checked
                                  ? [...prev, student.id]
                                  : prev.filter(id => id !== student.id)
                              );
                            }}
                            disabled={alreadyRecommended}
                            data-testid={`checkbox-student-${student.id}`}
                          />
                          <span className={cn("text-sm", alreadyRecommended && "text-muted-foreground line-through")}>
                            {student.name}
                            {student.grade && ` (${normalizeGrade(student.grade)})`}
                            {alreadyRecommended && " - 이미 배정됨"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </ScrollArea>
              </div>
              <div>
                <Label>추천사유 (선택)</Label>
                <Input
                  value={recommendNotes}
                  onChange={(e) => setRecommendNotes(e.target.value)}
                  placeholder="예: 중2과정 부족"
                  data-testid="input-recommend-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!recommendClassId || selectedStudents.length === 0) {
                    toast({ title: "수업과 학생을 선택해주세요", variant: "destructive" });
                    return;
                  }
                  createRecommendationMutation.mutate({
                    studentIds: selectedStudents,
                    announcementClassId: recommendClassId,
                    notes: recommendNotes || null,
                  });
                }}
                disabled={createRecommendationMutation.isPending}
                data-testid="button-save-recommendation"
              >
                배정
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Recommendation Dialog */}
        <Dialog open={!!editingRecommendation} onOpenChange={(open) => { if (!open) setEditingRecommendation(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>추천 배정 수정</DialogTitle>
              <DialogDescription>추천 수업이나 메모를 변경할 수 있습니다</DialogDescription>
            </DialogHeader>
            {editingRecommendation && (
              <div className="space-y-4">
                <div>
                  <Label>학생</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {studentUsers.find(s => s.id === editingRecommendation.studentId)?.name || "알 수 없음"}
                    {(() => {
                      const st = studentUsers.find(s => s.id === editingRecommendation.studentId);
                      return st?.grade ? ` (${normalizeGrade(st.grade)})` : "";
                    })()}
                  </p>
                </div>
                <div>
                  <Label>추천 수업</Label>
                  <Select value={editRecClassId} onValueChange={setEditRecClassId}>
                    <SelectTrigger data-testid="select-edit-rec-class">
                      <SelectValue placeholder="수업 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {announcementClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} {cls.subject}반
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>추천사유</Label>
                  <Input
                    value={editRecNotes}
                    onChange={(e) => setEditRecNotes(e.target.value)}
                    placeholder="예: 중2과정 부족"
                    data-testid="input-edit-rec-notes"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingRecommendation(null)}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (!editingRecommendation || !editRecClassId) return;
                  updateRecommendationMutation.mutate({
                    id: editingRecommendation.id,
                    data: {
                      announcementClassId: editRecClassId,
                      notes: editRecNotes || null,
                    },
                  });
                }}
                disabled={updateRecommendationMutation.isPending}
                data-testid="button-save-edit-rec"
              >
                {updateRecommendationMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Apply (추가 신청) Dialog */}
        <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>수업 추가 신청</DialogTitle>
              <DialogDescription>추천 외 수강하고 싶은 수업을 선택하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={applyClassSearch}
                onChange={(e) => setApplyClassSearch(e.target.value)}
                placeholder="수업명 검색"
                data-testid="input-apply-class-search"
              />
              <ScrollArea className="h-72 pr-3">
                {(() => {
                  const filtered = applyableClasses.filter(cls => {
                    const q = applyClassSearch.trim().toLowerCase();
                    if (!q) return true;
                    return `${cls.name} ${cls.subject}`.toLowerCase().includes(q);
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-8" data-testid="text-no-applyable-classes">
                        신청 가능한 수업이 없습니다
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      {filtered.map(cls => (
                        <button
                          key={cls.id}
                          type="button"
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/70 text-left disabled:opacity-50"
                          disabled={createApplicationMutation.isPending || !myStudentId}
                          onClick={() => {
                            if (!myStudentId) return;
                            createApplicationMutation.mutate({ announcementClassId: cls.id, studentId: myStudentId });
                          }}
                          data-testid={`button-apply-class-${cls.id}`}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cls.color || "#ccc" }}
                          />
                          <span className="text-sm flex-1 min-w-0 truncate">{cls.name} {cls.subject}반</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDays(cls.days)} {cls.startTime}-{cls.endTime}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Announcement List View
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="announcements-list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Megaphone className="h-6 w-6 shrink-0" />
            새 학기 수업 안내
          </h1>
          <p className="text-muted-foreground text-sm">새 학기 시간표와 추천 수업을 확인하세요</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ManualButton menuKey="semester-announcements" />
          {isStaff && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-announcement"
            >
              <Plus className="h-4 w-4 mr-1" />
              새 안내 만들기
            </Button>
          )}
        </div>
      </div>

      {visibleAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="text-no-announcements">
            {isStaff ? "새 학기 수업 안내를 만들어보세요" : "아직 게시된 안내가 없습니다"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visibleAnnouncements.map(ann => {
            const statusInfo = STATUS_LABELS[ann.status] || STATUS_LABELS.draft;
            return (
              <Card
                key={ann.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAnnouncement(ann)}
                data-testid={`card-announcement-${ann.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{ann.title}</span>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      {ann.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{ann.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {ann.createdAt && format(new Date(ann.createdAt), "yyyy년 M월 d일", { locale: ko })}
                      </p>
                    </div>
                    {isStaff && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("이 안내를 삭제하시겠습니까?")) {
                            deleteAnnouncementMutation.mutate(ann.id);
                          }
                        }}
                        data-testid={`button-delete-announcement-${ann.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Announcement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 학기 수업 안내 만들기</DialogTitle>
            <DialogDescription>새 학기 시간표와 추천 수업을 관리할 안내를 만듭니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목 *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="예: 2026년 봄학기 수업 안내"
                data-testid="input-create-title"
              />
            </div>
            <div>
              <Label>설명 (선택)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="안내에 대한 설명을 입력하세요"
                data-testid="input-create-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!formTitle) {
                  toast({ title: "제목을 입력해주세요", variant: "destructive" });
                  return;
                }
                createAnnouncementMutation.mutate({ title: formTitle, description: formDescription });
              }}
              disabled={createAnnouncementMutation.isPending}
              data-testid="button-save-create"
            >
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
