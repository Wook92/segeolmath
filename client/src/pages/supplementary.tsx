import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type User, type Class } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Plus, Trash2, Send, Clock, Users, Search, Loader2, Bell, X, MessageSquare, Pencil } from "lucide-react";
import { SmsTemplateSettings } from "@/components/supplementary-sms-settings";
import { ManualButton } from "@/components/manual-button";

const REASON_OPTIONS = [
  { value: "숙제 미흡", label: "숙제 미흡" },
  { value: "지각", label: "지각" },
  { value: "결석", label: "결석" },
  { value: "시험 통과 기준 미달", label: "시험 통과 기준 미달" },
  { value: "휴강", label: "휴강" },
  { value: "직접입력", label: "직접입력" },
];

interface SupplementaryClassData {
  id: string;
  centerId: string;
  teacherId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  classroom: string | null;
  reason: string | null;
  customReason: string | null;
  sendReminder: boolean | null;
  reminderTime: string | null;
  reminderSent: boolean | null;
  createdAt: string | null;
  teacher?: User;
  students?: Array<{
    id: string;
    studentId: string;
    smsSent: boolean | null;
    reminderSmsSent: boolean | null;
    student?: User;
  }>;
  studentCount?: number;
}

export default function SupplementaryPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsTargetStudents, setSmsTargetStudents] = useState<string[]>([]);
  const [showDayListDialog, setShowDayListDialog] = useState(false);
  const [activeView, setActiveView] = useState<"calendar" | "sms">("calendar");

  const isStudent = user?.role === UserRole.STUDENT;
  const isParent = user?.role === UserRole.PARENT;
  const isTeacher = user?.role === UserRole.TEACHER || user?.role === UserRole.CLINIC_TEACHER;
  const isPrincipalOrAdmin = user?.role === UserRole.PRINCIPAL || user?.role === UserRole.ADMIN;

  useEffect(() => {
    if (isTeacher && user) {
      setSelectedTeacherId(user.id);
    }
  }, [isTeacher, user]);

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: centerTeachers = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/teachers`],
    enabled: !!selectedCenter?.id,
  });

  const { data: centerStudents = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/students`],
    enabled: !!selectedCenter?.id,
  });

  const teachers = useMemo(() =>
    centerTeachers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.CLINIC_TEACHER || u.role === UserRole.PRINCIPAL),
    [centerTeachers]
  );

  const students = centerStudents;

  const queryTeacherId = isStudent || isParent ? undefined : (selectedTeacherId === null ? undefined : selectedTeacherId || undefined);
  const queryStudentId = isStudent ? user?.id : isParent ? (user as any)?.linkedStudentId : undefined;

  const { data: supplementaryClasses = [], isLoading } = useQuery<SupplementaryClassData[]>({
    queryKey: ["/api/supplementary-classes", selectedCenter?.id, monthStart, monthEnd, queryTeacherId],
    queryFn: async () => {
      const params = new URLSearchParams({
        centerId: selectedCenter?.id || "",
        startDate: monthStart,
        endDate: monthEnd,
        actorId: user?.id || "",
      });
      if (queryTeacherId) params.set("teacherId", queryTeacherId);
      const res = await fetch(`/api/supplementary-classes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  const { data: studentClasses = [] } = useQuery<any[]>({
    queryKey: ["/api/supplementary-classes/student", user?.id, monthStart, monthEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: monthStart, endDate: monthEnd });
      const res = await fetch(`/api/supplementary-classes/student/${user?.id}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!user?.id && (isStudent || isParent),
  });

  const { data: teacherClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${selectedTeacherId}/classes`, { centerId: selectedCenter?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/teachers/${selectedTeacherId}/classes?centerId=${selectedCenter?.id || ""}`);
      return res.json();
    },
    enabled: !!selectedTeacherId && !!selectedCenter?.id && !isStudent && !isParent,
  });

  const classesForCalendar = isStudent || isParent
    ? studentClasses.map((sc: any) => ({ ...sc.supplementaryClass, studentCount: 1 }))
    : supplementaryClasses;

  const classesByDate = useMemo(() => {
    const map = new Map<string, SupplementaryClassData[]>();
    for (const cls of classesForCalendar) {
      const existing = map.get(cls.date) || [];
      existing.push(cls);
      map.set(cls.date, existing);
    }
    return map;
  }, [classesForCalendar]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  const handleDateClick = (dateStr: string) => {
    if (isStudent || isParent) {
      setSelectedDate(dateStr);
      const dayClasses = classesByDate.get(dateStr) || [];
      if (dayClasses.length === 1) {
        setSelectedClassId(dayClasses[0].id);
        setShowDetailDialog(true);
      } else if (dayClasses.length > 1) {
        setShowDayListDialog(true);
      }
      return;
    }
    const dayClasses = classesByDate.get(dateStr) || [];
    setSelectedDate(dateStr);
    if (dayClasses.length > 0) {
      setShowDayListDialog(true);
    } else {
      setShowCreateDialog(true);
    }
  };

  const selectedDayClasses = useMemo(() => {
    if (!selectedDate) return [];
    const classes = classesByDate.get(selectedDate) || [];
    return [...classes].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [selectedDate, classesByDate]);

  const getReasonDisplay = (reason: string | null, customReason: string | null) => {
    if (!reason) return "";
    if (reason === "직접입력") return customReason || "";
    return reason;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto" data-testid="supplementary-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">보충</h1>
          <ManualButton menuKey="supplementary" />
        </div>
        {!isStudent && !isParent && (
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${activeView === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveView("calendar")}
              data-testid="tab-calendar"
            >
              일정
            </button>
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${activeView === "sms" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveView("sms")}
              data-testid="tab-sms-settings"
            >
              문자설정
            </button>
          </div>
        )}
      </div>

      {activeView === "sms" && !isStudent && !isParent && (
        <SmsTemplateSettings centerId={selectedCenter?.id || ""} actorId={user?.id || ""} />
      )}

      {activeView === "calendar" && isPrincipalOrAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedTeacherId === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTeacherId(null)}
            data-testid="button-teacher-all"
          >
            전체
          </Button>
          {teachers.map(t => (
            <Button
              key={t.id}
              variant={selectedTeacherId === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTeacherId(t.id)}
              data-testid={`button-teacher-${t.id}`}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}

      {activeView === "calendar" && (<>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedDate(null); }} data-testid="button-prev-month">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-lg" data-testid="text-current-month">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedDate(null); }} data-testid="button-next-month">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {["일", "월", "화", "수", "목", "금", "토"].map(day => (
                <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium">{day}</div>
              ))}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
              ))}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayClasses = classesByDate.get(dateStr) || [];
                const hasClasses = dayClasses.length > 0;
                return (
                  <div
                    key={dateStr}
                    className={`bg-background p-1 md:p-2 min-h-[80px] cursor-pointer hover:bg-muted/30 transition-colors
                      ${selectedDate === dateStr ? "bg-primary/10 ring-2 ring-primary ring-inset" : isToday(day) ? "ring-2 ring-primary/50 ring-inset" : ""}
                      ${!isSameMonth(day, currentMonth) ? "opacity-40" : ""}`}
                    onClick={() => handleDateClick(dateStr)}
                    data-testid={`calendar-day-${dateStr}`}
                  >
                    <div className={`text-xs md:text-sm font-medium mb-1 flex items-center justify-between ${isToday(day) ? "text-primary" : getDay(day) === 0 ? "text-red-500" : getDay(day) === 6 ? "text-blue-500" : ""}`}>
                      <span>{format(day, "d")}</span>
                      {!isStudent && !isParent && (
                        <Plus className="w-3 h-3 text-muted-foreground/50" />
                      )}
                    </div>
                    {hasClasses && (
                      <div className="space-y-0.5">
                        {dayClasses.slice(0, 2).map((cls, idx) => (
                          <div
                            key={cls.id || idx}
                            className="text-[10px] md:text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded px-1 py-0.5 truncate"
                          >
                            {selectedTeacherId === null && cls.teacher ? `${cls.teacher.name} ` : ""}{cls.startTime}~{cls.endTime || "미정"}
                            {cls.studentCount != null && ` (${cls.studentCount}명)`}
                          </div>
                        ))}
                        {dayClasses.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">+{dayClasses.length - 2}개</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!isStudent && !isParent && selectedDate && (
        <Card data-testid="card-selected-day-classes">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {(() => {
                  try {
                    const d = new Date(selectedDate + "T00:00:00");
                    return format(d, "M월 d일 (EEE)", { locale: ko });
                  } catch { return selectedDate; }
                })()}
                {selectedDayClasses.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{selectedDayClasses.length}건</Badge>
                )}
              </h3>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                data-testid="button-create-from-day-list"
              >
                <Plus className="w-4 h-4 mr-1" />새 보충
              </Button>
            </div>
            {selectedDayClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">이 날짜에 보충 일정이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {selectedDayClasses.map(cls => {
                  const reasonText = getReasonDisplay(cls.reason, cls.customReason);
                  return (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setShowDetailDialog(true);
                      }}
                      data-testid={`day-class-item-${cls.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-sm font-semibold">{cls.startTime}</span>
                          <span className="text-xs text-muted-foreground">~{cls.endTime || "미정"}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {cls.teacher && (
                              <Badge variant="outline" className="text-xs">{cls.teacher.name}</Badge>
                            )}
                            {cls.classroom && (
                              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">강의실 {cls.classroom}</Badge>
                            )}
                            {cls.studentCount != null && (
                              <Badge variant="secondary" className="text-xs">{cls.studentCount}명</Badge>
                            )}
                          </div>
                          {reasonText && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{reasonText}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showCreateDialog && selectedDate && (
        <CreateSupplementaryDialog
          open={showCreateDialog}
          onOpenChange={(open) => { setShowCreateDialog(open); }}
          date={selectedDate}
          centerId={selectedCenter?.id || ""}
          teacherId={selectedTeacherId || user?.id || ""}
          students={students}
          teacherClasses={teacherClasses}
          centerName={selectedCenter?.name || ""}
          actorId={user?.id || ""}
          existingClasses={classesForCalendar.filter(c => c.date === selectedDate && c.teacherId === (selectedTeacherId || user?.id || ""))}
          showTeacherSelect={isPrincipalOrAdmin && selectedTeacherId === null}
          allTeachers={teachers}
        />
      )}

      {showDetailDialog && selectedClassId && (
        <SupplementaryDetailDialog
          open={showDetailDialog}
          onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setSelectedClassId(null); }}
          classId={selectedClassId}
          centerId={selectedCenter?.id || ""}
          centerName={selectedCenter?.name || ""}
          isReadOnly={isStudent || isParent}
          students={students}
          teacherClasses={teacherClasses}
          teacherId={selectedTeacherId || user?.id || ""}
          actorId={user?.id || ""}
        />
      )}

      {showDayListDialog && selectedDate && (
        <Dialog open={showDayListDialog} onOpenChange={(open) => { setShowDayListDialog(open); if (!open) setSelectedDate(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>보충 일정</DialogTitle>
              <DialogDescription>
                {(() => {
                  try {
                    const d = new Date(selectedDate + "T00:00:00");
                    return format(d, "yyyy년 M월 d일 (EEE)", { locale: ko });
                  } catch { return selectedDate; }
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {(classesByDate.get(selectedDate) || []).map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setShowDayListDialog(false);
                    setShowDetailDialog(true);
                  }}
                  data-testid={`day-list-item-${cls.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    {selectedTeacherId === null && cls.teacher && (
                      <Badge variant="outline" className="text-xs shrink-0">{cls.teacher.name}</Badge>
                    )}
                    <span className="text-sm font-medium">{cls.startTime} ~ {cls.endTime || "미정"}</span>
                    {cls.studentCount != null && (
                      <Badge variant="secondary" className="text-xs">{cls.studentCount}명</Badge>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
            {!isStudent && !isParent && (
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowDayListDialog(false);
                    setShowCreateDialog(true);
                  }}
                  data-testid="button-create-new-supplementary"
                >
                  <Plus className="w-4 h-4 mr-1" />새 보충 만들기
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
      </>)}

    </div>
  );
}

function CreateSupplementaryDialog({
  open, onOpenChange, date, centerId, teacherId, students, teacherClasses, centerName, actorId, existingClasses, showTeacherSelect, allTeachers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  centerId: string;
  teacherId: string;
  students: User[];
  teacherClasses: Class[];
  centerName: string;
  actorId: string;
  existingClasses: SupplementaryClassData[];
  showTeacherSelect?: boolean;
  allTeachers?: User[];
}) {
  const { toast } = useToast();
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [endTimeUndefined, setEndTimeUndefined] = useState(false);
  const [classroom, setClassroom] = useState("");
  const [dialogTeacherId, setDialogTeacherId] = useState<string>(teacherId || "");
  const [includeReason, setIncludeReason] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [sendReminder, setSendReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [sendSmsOnCreate, setSendSmsOnCreate] = useState(true);

  const effectiveTeacherId = showTeacherSelect ? dialogTeacherId : teacherId;

  const { data: dialogTeacherClasses = [] } = useQuery<Class[]>({
    queryKey: [`/api/teachers/${effectiveTeacherId}/classes`, { centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/teachers/${effectiveTeacherId}/classes?centerId=${centerId}`);
      return res.json();
    },
    enabled: !!effectiveTeacherId && !!centerId && showTeacherSelect === true,
  });

  const activeTeacherClasses = showTeacherSelect ? dialogTeacherClasses : teacherClasses;

  const { data: classEnrollments = [] } = useQuery<any[]>({
    queryKey: [`/api/classes/${selectedClassFilter}/students`],
    enabled: selectedClassFilter !== "all" && selectedClassFilter !== "",
  });

  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedClassFilter && selectedClassFilter !== "all" && classEnrollments.length > 0) {
      const enrolledIds = new Set(classEnrollments.map((e: any) => e.id));
      list = list.filter(s => enrolledIds.has(s.id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q));
    }
    return list;
  }, [students, selectedClassFilter, classEnrollments, searchQuery]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    const ids = filteredStudents.map(s => s.id);
    const allSelected = ids.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedStudentIds(prev => {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      });
    }
  };

  const checkTimeOverlap = (): SupplementaryClassData | null => {
    for (const cls of existingClasses) {
      if (cls.endTime && startTime < cls.endTime && endTime > cls.startTime) {
        return cls;
      }
    }
    return null;
  };

  const handleCreate = () => {
    if (!effectiveTeacherId) {
      toast({ title: "선생님을 선택해 주세요" });
      return;
    }
    if (!endTimeUndefined && endTime && startTime >= endTime) {
      toast({ title: "시작 시간이 종료 시간보다 같거나 늦습니다", description: "시간을 다시 확인해 주세요", variant: "destructive" });
      return;
    }
    const overlap = checkTimeOverlap();
    if (overlap) {
      const confirmed = window.confirm(
        `같은 날짜에 ${overlap.startTime}~${overlap.endTime || "미정"} 보충 시간이 겹칩니다.\n그래도 생성하시겠습니까?`
      );
      if (!confirmed) return;
    }
    createMutation.mutate();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/supplementary-classes", {
        actorId,
        centerId,
        teacherId: effectiveTeacherId,
        date,
        startTime,
        endTime: endTimeUndefined ? null : endTime,
        classroom: classroom.trim() || null,
        reason: includeReason ? (reason || null) : null,
        customReason: includeReason && reason === "직접입력" ? customReason : null,
        sendReminder,
        reminderTime: sendReminder ? reminderTime : null,
        studentIds: selectedStudentIds,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      toast({ title: "보충 일정이 생성되었습니다" });
      if (sendSmsOnCreate && selectedStudentIds.length > 0 && data?.id) {
        try {
          await apiRequest("POST", `/api/supplementary-classes/${data.id}/send-sms`, { actorId });
          toast({ title: `${selectedStudentIds.length}명에게 보충 안내 문자를 발송했습니다` });
        } catch {
          toast({ title: "문자 발송에 실패했습니다", variant: "destructive" });
        }
      }
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "보충 일정 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const formattedDate = (() => {
    try {
      const d = new Date(date + "T00:00:00");
      return format(d, "yyyy년 M월 d일 (EEE)", { locale: ko });
    } catch { return date; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>보충 일정 만들기</DialogTitle>
          <DialogDescription>{formattedDate}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showTeacherSelect && allTeachers && allTeachers.length > 0 && (
            <div className="space-y-2">
              <Label>선생님 선택</Label>
              <div className="flex flex-wrap gap-1.5">
                {allTeachers.map(t => (
                  <Button
                    key={t.id}
                    variant={dialogTeacherId === t.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDialogTeacherId(t.id);
                      setSelectedClassFilter("all");
                    }}
                    data-testid={`button-dialog-teacher-${t.id}`}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label>시작 시간</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} data-testid="input-start-time" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>종료 시간</Label>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={endTimeUndefined}
                    onCheckedChange={(v) => setEndTimeUndefined(!!v)}
                    data-testid="checkbox-end-time-undefined"
                    id="end-time-undefined"
                  />
                  <label htmlFor="end-time-undefined" className="text-xs text-muted-foreground cursor-pointer">미지정</label>
                </div>
              </div>
              {endTimeUndefined ? (
                <div className="h-10 flex items-center text-sm text-muted-foreground bg-muted rounded-md px-3">미지정</div>
              ) : (
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} data-testid="input-end-time" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>강의실 (선택)</Label>
            <Input
              placeholder="예: 301호"
              value={classroom}
              onChange={e => setClassroom(e.target.value)}
              data-testid="input-classroom"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeReason}
                onCheckedChange={(v) => setIncludeReason(!!v)}
                data-testid="checkbox-include-reason"
              />
              <Label className="cursor-pointer text-sm" onClick={() => setIncludeReason(!includeReason)}>보충 사유 포함</Label>
            </div>
            {includeReason && (
              <div className="space-y-2">
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full" data-testid="select-reason">
                    <SelectValue placeholder="사유 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reason === "직접입력" && (
                  <div className="mt-2">
                    <Textarea
                      placeholder="사유를 입력하세요 (최대 100자)"
                      value={customReason}
                      maxLength={100}
                      onChange={e => { if (e.target.value.length <= 100) setCustomReason(e.target.value); }}
                      rows={3}
                      data-testid="input-custom-reason"
                    />
                    <p className={`text-xs mt-1 text-right ${customReason.length >= 100 ? "text-destructive" : "text-muted-foreground"}`}>{customReason.length}/100</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>학생 선택 ({selectedStudentIds.length}명)</Label>
              <Button variant="ghost" size="sm" onClick={selectAllFiltered} data-testid="button-select-all">
                {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id)) ? "전체해제" : "전체선택"}
              </Button>
            </div>

            {activeTeacherClasses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={selectedClassFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClassFilter("all")}
                  data-testid="button-class-filter-all"
                >
                  선택 안함
                </Button>
                {activeTeacherClasses.map(cls => (
                  <Button
                    key={cls.id}
                    variant={selectedClassFilter === cls.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedClassFilter(cls.id)}
                    data-testid={`button-class-filter-${cls.id}`}
                  >
                    {cls.name} {cls.subject}반
                  </Button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="학생 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-student"
              />
            </div>

            <ScrollArea className="h-[200px] border rounded-md p-2">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">학생이 없습니다</p>
              ) : (
                <div className="space-y-1">
                  {filteredStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedStudentIds.includes(s.id)}
                        onCheckedChange={() => toggleStudent(s.id)}
                        data-testid={`checkbox-student-${s.id}`}
                      />
                      <span className="text-sm flex-1">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.grade} · {s.school}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={sendSmsOnCreate}
              onCheckedChange={(v) => setSendSmsOnCreate(!!v)}
              data-testid="checkbox-send-sms"
            />
            <Label className="cursor-pointer text-sm">생성 시 학부모에게 안내 문자 보내기</Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={sendReminder}
                onCheckedChange={(v) => setSendReminder(!!v)}
                data-testid="checkbox-send-reminder"
              />
              <Label className="cursor-pointer text-sm">
                <Bell className="w-3.5 h-3.5 inline mr-1" />
                전날 예약 문자 보내기
              </Label>
            </div>
            {sendReminder && (
              <div className="flex items-center gap-2 ml-6">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">발송 시각</Label>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-28 h-8 text-sm"
                  data-testid="input-reminder-time"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || selectedStudentIds.length === 0}
            data-testid="button-create-supplementary"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            보충 일정 만들기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplementaryDetailDialog({
  open, onOpenChange, classId, centerId, centerName, isReadOnly, students: allStudents, teacherClasses, teacherId, actorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  centerId: string;
  centerName: string;
  isReadOnly: boolean;
  students: User[];
  teacherClasses: Class[];
  teacherId: string;
  actorId: string;
}) {
  const { toast } = useToast();
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [newStudentIds, setNewStudentIds] = useState<string[]>([]);
  const [smsMessage, setSmsMessage] = useState("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsTargetIds, setSmsTargetIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showSmsHistory, setShowSmsHistory] = useState(false);
  const [studentSmsHistoryId, setStudentSmsHistoryId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editEndTimeUndefined, setEditEndTimeUndefined] = useState(false);
  const [editClassroom, setEditClassroom] = useState("");
  const [editIncludeReason, setEditIncludeReason] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editCustomReason, setEditCustomReason] = useState("");
  const [editSendReminder, setEditSendReminder] = useState(false);
  const [editReminderTime, setEditReminderTime] = useState("18:00");

  const { data: classDetail, isLoading } = useQuery<SupplementaryClassData>({
    queryKey: ["/api/supplementary-classes", classId],
    queryFn: async () => {
      const res = await fetch(`/api/supplementary-classes/${classId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!classId,
  });

  interface SmsHistoryRecord {
    id: string;
    studentId: string;
    studentName: string;
    senderName: string;
    recipientPhone: string;
    recipientType: string;
    message: string;
    status: string;
    sentAt: string;
  }

  const { data: smsHistoryData = [] } = useQuery<SmsHistoryRecord[]>({
    queryKey: [`/api/supplementary-classes/${classId}/sms-history`],
    queryFn: async () => {
      const res = await fetch(`/api/supplementary-classes/${classId}/sms-history?actorId=${actorId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!classId,
  });

  const { data: classEnrollments = [] } = useQuery<any[]>({
    queryKey: [`/api/classes/${selectedClassFilter}/students`],
    enabled: selectedClassFilter !== "all" && selectedClassFilter !== "" && showAddStudents,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/supplementary-classes/${classId}?actorId=${actorId}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      toast({ title: "보충 일정이 삭제되었습니다" });
      onOpenChange(false);
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest("DELETE", `/api/supplementary-classes/${classId}/students/${studentId}?actorId=${actorId}`),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      toast({ title: "학생이 제거되었습니다" });
    },
  });

  const addStudentsMutation = useMutation({
    mutationFn: (studentIds: string[]) =>
      apiRequest("POST", `/api/supplementary-classes/${classId}/students`, { studentIds, actorId }),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      setNewStudentIds([]);
      setShowAddStudents(false);
      toast({ title: "학생이 추가되었습니다" });
    },
  });

  const startEditing = () => {
    if (!classDetail) return;
    setEditStartTime(classDetail.startTime);
    setEditEndTime(classDetail.endTime || "15:00");
    setEditEndTimeUndefined(!classDetail.endTime);
    setEditClassroom(classDetail.classroom || "");
    setEditIncludeReason(!!classDetail.reason);
    setEditReason(classDetail.reason || "");
    setEditCustomReason(classDetail.customReason || "");
    setEditSendReminder(!!classDetail.sendReminder);
    setEditReminderTime(classDetail.reminderTime || "18:00");
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/supplementary-classes/${classId}`, {
        actorId,
        startTime: editStartTime,
        endTime: editEndTimeUndefined ? null : editEndTime,
        classroom: editClassroom.trim() || null,
        reason: editIncludeReason ? (editReason || null) : null,
        customReason: editIncludeReason && editReason === "직접입력" ? editCustomReason : null,
        sendReminder: editSendReminder,
        reminderTime: editSendReminder ? editReminderTime : null,
      }),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      setIsEditing(false);
      toast({ title: "보충 일정이 수정되었습니다" });
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: (data: { studentIds?: string[]; message?: string }) =>
      apiRequest("POST", `/api/supplementary-classes/${classId}/send-sms`, { ...data, actorId }),
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/supplementary-classes");
      queryClient.invalidateQueries({ queryKey: [`/api/supplementary-classes/${classId}/sms-history`] });
      toast({ title: "문자가 발송되었습니다" });
      setShowSmsDialog(false);
      setShowSmsHistory(true);
    },
    onError: () => {
      toast({ title: "문자 발송에 실패했습니다", variant: "destructive" });
    },
  });

  const existingStudentIds = useMemo(() =>
    new Set((classDetail?.students || []).map(s => s.studentId)),
    [classDetail]
  );

  const filteredNewStudents = useMemo(() => {
    let list = allStudents.filter(s => !existingStudentIds.has(s.id));
    if (selectedClassFilter && selectedClassFilter !== "all" && classEnrollments.length > 0) {
      const enrolledIds = new Set(classEnrollments.map((e: any) => e.id));
      list = list.filter(s => enrolledIds.has(s.id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q));
    }
    return list;
  }, [allStudents, existingStudentIds, selectedClassFilter, classEnrollments, searchQuery]);

  if (isLoading || !classDetail) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  const formattedDate = (() => {
    try {
      const d = new Date(classDetail.date + "T00:00:00");
      return format(d, "yyyy년 M월 d일 (EEE)", { locale: ko });
    } catch { return classDetail.date; }
  })();

  const reasonDisplay = classDetail.reason === "직접입력" ? classDetail.customReason : classDetail.reason;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>보충 일정 상세</DialogTitle>
            <DialogDescription>{formattedDate}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isEditing ? (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">시작 시간</Label>
                    <Input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} data-testid="edit-start-time" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">종료 시간</Label>
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={editEndTimeUndefined} onCheckedChange={(v) => setEditEndTimeUndefined(!!v)} id="edit-end-time-undefined" />
                        <label htmlFor="edit-end-time-undefined" className="text-xs text-muted-foreground cursor-pointer">미지정</label>
                      </div>
                    </div>
                    {editEndTimeUndefined ? (
                      <div className="h-10 flex items-center text-sm text-muted-foreground bg-muted rounded-md px-3">미지정</div>
                    ) : (
                      <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} data-testid="edit-end-time" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">강의실 (선택)</Label>
                  <Input placeholder="예: 301호" value={editClassroom} onChange={e => setEditClassroom(e.target.value)} data-testid="edit-classroom" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editIncludeReason} onCheckedChange={(v) => setEditIncludeReason(!!v)} />
                    <Label className="cursor-pointer text-xs" onClick={() => setEditIncludeReason(!editIncludeReason)}>보충 사유 포함</Label>
                  </div>
                  {editIncludeReason && (
                    <div className="space-y-2">
                      <Select value={editReason} onValueChange={setEditReason}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="사유 선택" /></SelectTrigger>
                        <SelectContent>
                          {REASON_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editReason === "직접입력" && (
                        <div>
                          <Textarea placeholder="사유를 입력하세요 (최대 100자)" value={editCustomReason} maxLength={100} onChange={e => { if (e.target.value.length <= 100) setEditCustomReason(e.target.value); }} rows={3} />
                          <p className={`text-xs mt-1 text-right ${editCustomReason.length >= 100 ? "text-destructive" : "text-muted-foreground"}`}>{editCustomReason.length}/100</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={editSendReminder} onCheckedChange={(v) => setEditSendReminder(!!v)} />
                    <Label className="cursor-pointer text-xs" onClick={() => setEditSendReminder(!editSendReminder)}>전날 예약 문자 발송</Label>
                  </div>
                  {editSendReminder && (
                    <div className="flex items-center gap-2 ml-6">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">발송 시각</Label>
                      <Input
                        type="time"
                        value={editReminderTime}
                        onChange={(e) => setEditReminderTime(e.target.value)}
                        className="w-28 h-8 text-sm"
                        data-testid="input-edit-reminder-time"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">취소</Button>
                  <Button size="sm" onClick={() => {
                    if (!editEndTimeUndefined && editEndTime && editStartTime >= editEndTime) {
                      toast({ title: "시작 시간이 종료 시간보다 같거나 늦습니다", description: "시간을 다시 확인해 주세요", variant: "destructive" });
                      return;
                    }
                    updateMutation.mutate();
                  }} disabled={updateMutation.isPending} data-testid="button-save-edit">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}저장
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{classDetail.startTime} ~ {classDetail.endTime || "미정"}</span>
                    </div>
                    {classDetail.teacher && (
                      <Badge variant="outline">{classDetail.teacher.name} 선생님</Badge>
                    )}
                    {classDetail.classroom && (
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20">강의실 {classDetail.classroom}</Badge>
                    )}
                  </div>
                  {!isReadOnly && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing} data-testid="button-edit-class">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {reasonDisplay && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">사유: </span>
                    <Badge variant="secondary">{reasonDisplay}</Badge>
                  </div>
                )}

                {classDetail.sendReminder && (
                  <div className="text-sm flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      전날 예약 문자 {classDetail.reminderTime || "18:00"} 발송 {classDetail.reminderSent ? "(완료)" : "(예정)"}
                    </span>
                  </div>
                )}
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  학생 목록 ({classDetail.students?.length || 0}명)
                </Label>
                {!isReadOnly && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddStudents(!showAddStudents)} data-testid="button-add-students">
                      <Plus className="w-4 h-4 mr-1" />추가
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSmsTargetIds([]);
                        setShowSmsDialog(true);
                      }}
                      data-testid="button-send-all-sms"
                    >
                      <Send className="w-4 h-4 mr-1" />전체 문자
                    </Button>
                  </div>
                )}
              </div>

              <div className="border rounded-md divide-y">
                {(classDetail.students || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">등록된 학생이 없습니다</p>
                ) : (
                  (classDetail.students || []).map(entry => {
                    const studentSmsCount = smsHistoryData.filter(r => r.studentId === entry.studentId).length;
                    return (
                    <div key={entry.id}>
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.student?.name || "알 수 없음"}</span>
                          <span className="text-xs text-muted-foreground">{entry.student?.grade} · {entry.student?.school}</span>
                          {entry.smsSent && <Badge variant="outline" className="text-[10px] h-5">문자발송</Badge>}
                          {studentSmsCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => setStudentSmsHistoryId(studentSmsHistoryId === entry.studentId ? null : entry.studentId)}
                              data-testid={`button-sms-history-${entry.studentId}`}
                            >
                              <MessageSquare className="w-3 h-3 mr-0.5" />
                              {studentSmsCount}
                            </Button>
                          )}
                        </div>
                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary/80"
                              title="학부모에게 문자 보내기"
                              onClick={() => {
                                setSmsTargetIds([entry.studentId]);
                                setShowSmsDialog(true);
                              }}
                              data-testid={`button-sms-${entry.studentId}`}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeStudentMutation.mutate(entry.studentId)}
                              data-testid={`button-remove-${entry.studentId}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {studentSmsHistoryId === entry.studentId && (
                        <div className="px-2 pb-2">
                          <div className="border rounded-md p-2 bg-muted/30 space-y-1.5">
                            {smsHistoryData
                              .filter(r => r.studentId === entry.studentId)
                              .map((record) => (
                                <div key={record.id} className="text-xs space-y-0.5 border-b last:border-b-0 pb-1.5 last:pb-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className="text-[10px] h-4">
                                        {record.recipientType === "mother" ? "어머니" : record.recipientType === "father" ? "아버지" : "학생"}
                                      </Badge>
                                      <Badge variant={record.status === "sent" ? "default" : "destructive"} className="text-[10px] h-4">
                                        {record.status === "sent" ? "발송완료" : "실패"}
                                      </Badge>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {record.sentAt ? format(new Date(record.sentAt), "M/d HH:mm", { locale: ko }) : ""}
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground whitespace-pre-wrap break-words">
                                    {record.message}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    발송: {record.senderName} · {record.recipientPhone}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            </div>

            {showAddStudents && !isReadOnly && (
              <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                <Label>학생 추가</Label>
                {teacherClasses.length > 0 && (
                  <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                    <SelectTrigger><SelectValue placeholder="반 선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {teacherClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} {cls.subject}반</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="학생 검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <ScrollArea className="h-[150px]">
                  {filteredNewStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={newStudentIds.includes(s.id)}
                        onCheckedChange={() => setNewStudentIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                      />
                      <span className="text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.grade} · {s.school}</span>
                    </label>
                  ))}
                </ScrollArea>
                <Button
                  size="sm"
                  disabled={newStudentIds.length === 0 || addStudentsMutation.isPending}
                  onClick={() => addStudentsMutation.mutate(newStudentIds)}
                >
                  {addStudentsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {newStudentIds.length}명 추가
                </Button>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("보충 일정을 삭제하시겠습니까?")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-supplementary"
              >
                <Trash2 className="w-4 h-4 mr-1" />삭제
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {showSmsDialog && (
        <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>보충 안내 문자 보내기</DialogTitle>
              <DialogDescription>
                {smsTargetIds.length > 0
                  ? `${smsTargetIds.length}명의 학부모에게 문자를 보냅니다`
                  : `전체 ${classDetail.students?.length || 0}명의 학부모에게 문자를 보냅니다`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <p><strong>날짜:</strong> {formattedDate}</p>
                <p><strong>시간:</strong> {classDetail.startTime} ~ {classDetail.endTime || "미정"}</p>
                {classDetail.classroom && <p><strong>강의실:</strong> {classDetail.classroom}</p>}
                {reasonDisplay && <p><strong>사유:</strong> {reasonDisplay}</p>}
              </div>
              <div className="space-y-1">
                <Label>추가 메시지 (선택사항)</Label>
                <Textarea
                  value={smsMessage}
                  onChange={e => setSmsMessage(e.target.value)}
                  placeholder="추가로 전달할 내용이 있으면 입력하세요"
                  className="min-h-[60px]"
                  data-testid="input-sms-message"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSmsDialog(false)}>취소</Button>
              <Button
                onClick={() => sendSmsMutation.mutate({
                  studentIds: smsTargetIds.length > 0 ? smsTargetIds : undefined,
                  message: smsMessage || undefined,
                })}
                disabled={sendSmsMutation.isPending}
                data-testid="button-confirm-send-sms"
              >
                {sendSmsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Send className="w-4 h-4 mr-1" />문자 보내기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
