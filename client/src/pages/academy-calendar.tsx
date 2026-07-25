import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { Plus, ChevronLeft, ChevronRight, Calendar, BookOpen, Trash2, Pencil, X, Users, Check, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type AcademyCalendarEvent, type ExamSubjectSchedule, type User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale";

const EVENT_COLORS = [
  { value: "#3B82F6", label: "파랑" },
  { value: "#10B981", label: "초록" },
  { value: "#F59E0B", label: "주황" },
  { value: "#EF4444", label: "빨강" },
  { value: "#8B5CF6", label: "보라" },
  { value: "#EC4899", label: "분홍" },
  { value: "#6366F1", label: "인디고" },
  { value: "#14B8A6", label: "청록" },
];

const EVENT_TYPES = [
  { value: "single", label: "단일 날짜" },
  { value: "period", label: "기간" },
  { value: "exam", label: "시험" },
];

const GRADE_OPTIONS = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3","성인"];

function normalizeGrade(grade: string | null | undefined): string {
  if (!grade) return "";
  const mapping: Record<string, string> = {
    "초등학교 1학년": "초1", "초등학교 2학년": "초2", "초등학교 3학년": "초3",
    "초등학교 4학년": "초4", "초등학교 5학년": "초5", "초등학교 6학년": "초6",
    "중학교 1학년": "중1", "중학교 2학년": "중2", "중학교 3학년": "중3",
    "고등학교 1학년": "고1", "고등학교 2학년": "고2", "고등학교 3학년": "고3",
  };
  return mapping[grade] || grade.trim();
}

function SchoolCombobox({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const showCreate = trimmed.length > 0 && !options.some(o => o === trimmed);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="button-exam-school"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || "학교 선택 또는 검색"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="학교 검색..." value={query} onValueChange={setQuery} data-testid="input-school-search" />
          <CommandList>
            <CommandEmpty>학교를 찾을 수 없습니다</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onChange(""); setQuery(""); setOpen(false); }} data-testid="option-school-clear">
                  <X className="mr-2 h-4 w-4" />
                  선택 해제
                </CommandItem>
              </CommandGroup>
            )}
            {options.length > 0 && (
              <CommandGroup heading="등록된 학교">
                {options.map(opt => (
                  <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setQuery(""); setOpen(false); }} data-testid={`option-school-${opt}`}>
                    <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup heading="직접 입력">
                <CommandItem value={`__create__${trimmed}`} onSelect={() => { onChange(trimmed); setQuery(""); setOpen(false); }} data-testid="option-school-create">
                  <Plus className="mr-2 h-4 w-4" />
                  "{trimmed}" 직접 입력
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ExamSubject {
  examDate: string;
  subjects: string;
  grade: string;
  excludedStudentIds: string[];
}

export default function AcademyCalendar() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademyCalendarEvent | null>(null);
  const [rosterItem, setRosterItem] = useState<{ scheduleId: string; school: string; grade: string; subjects: string } | null>(null);
  
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventType: "single" as "single" | "period" | "exam",
    startDate: "",
    endDate: "",
    color: "#3B82F6",
    school: "",
    examSubjects: [] as ExamSubject[],
  });

  const canManage = user && user.role >= UserRole.TEACHER;
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const { data: events = [], isLoading } = useQuery<AcademyCalendarEvent[]>({
    queryKey: ["/api/academy-calendar-events", selectedCenter?.id, currentYear, currentMonth],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/academy-calendar-events?centerId=${selectedCenter.id}&year=${currentYear}&month=${currentMonth}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  // 다음 달 이벤트도 가져온다: 이번 달 말일(예: 6/30)이 다음 달 1일(7/1) 시험의 직전 보강일이 되는 경우 계산용
  const nextMonthDate = addMonths(currentDate, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const { data: nextMonthEvents = [] } = useQuery<AcademyCalendarEvent[]>({
    queryKey: ["/api/academy-calendar-events", selectedCenter?.id, nextYear, nextMonth],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/academy-calendar-events?centerId=${selectedCenter.id}&year=${nextYear}&month=${nextMonth}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  // 시험 일정/직전 보강 계산용 시험 이벤트 (이번 달 + 다음 달, ID 기준 중복 제거)
  const examEventsForSchedules = useMemo(() => {
    const map = new Map<string, AcademyCalendarEvent>();
    [...events, ...nextMonthEvents].forEach(e => {
      if (e.eventType === "exam") map.set(e.id, e);
    });
    return Array.from(map.values());
  }, [events, nextMonthEvents]);

  const { data: examSchedulesMap = {} } = useQuery<Record<string, ExamSubjectSchedule[]>>({
    queryKey: ["/api/exam-subject-schedules", examEventsForSchedules.map(e => e.id).sort()],
    queryFn: async () => {
      const schedules: Record<string, ExamSubjectSchedule[]> = {};
      for (const event of examEventsForSchedules) {
        const res = await fetch(`/api/exam-subject-schedules/${event.id}`);
        schedules[event.id] = await res.json();
      }
      return schedules;
    },
    enabled: examEventsForSchedules.length > 0,
  });

  const { data: centerStudents = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/students`],
    enabled: !!selectedCenter?.id,
  });

  const schoolOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of centerStudents) {
      if (s.role === UserRole.STUDENT && s.school && s.school.trim()) set.add(s.school.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [centerStudents]);

  const updateExclusionMutation = useMutation({
    mutationFn: async ({ scheduleId, excludedStudentIds }: { scheduleId: string; excludedStudentIds: string[] }) => {
      return apiRequest("PATCH", `/api/exam-subject-schedules/${scheduleId}?actorId=${user?.id}`, { excludedStudentIds });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/exam-subject-schedules");
    },
    onError: () => {
      toast({ title: "보강 명단 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      console.log("Creating calendar event with data:", {
        centerId: selectedCenter?.id,
        userId: user?.id,
        ...data,
      });
      return apiRequest("POST", `/api/academy-calendar-events?actorId=${user?.id}`, {
        centerId: selectedCenter?.id,
        ...data,
      });
    },
    onSuccess: () => {
      toast({ title: "일정이 등록되었습니다" });
      invalidateQueriesStartingWith("/api/academy-calendar-events");
      invalidateQueriesStartingWith("/api/exam-subject-schedules");
      setIsEventDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Calendar event creation error:", error);
      const message = error?.message || error?.details || "알 수 없는 오류";
      toast({ 
        title: "일정 등록에 실패했습니다", 
        description: message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof eventForm & { id: string }) => {
      return apiRequest("PATCH", `/api/academy-calendar-events/${data.id}?actorId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "일정이 수정되었습니다" });
      invalidateQueriesStartingWith("/api/academy-calendar-events");
      invalidateQueriesStartingWith("/api/exam-subject-schedules");
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "일정 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/academy-calendar-events/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "일정이 삭제되었습니다" });
      invalidateQueriesStartingWith("/api/academy-calendar-events");
      invalidateQueriesStartingWith("/api/exam-subject-schedules");
      setIsDetailDialogOpen(false);
    },
    onError: () => {
      toast({ title: "일정 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEventForm({
      title: "",
      description: "",
      eventType: "single",
      startDate: "",
      endDate: "",
      color: "#3B82F6",
      school: "",
      examSubjects: [],
    });
  };

  const handleOpenCreateDialog = (date?: Date) => {
    resetForm();
    if (date) {
      setEventForm(prev => ({
        ...prev,
        startDate: format(date, "yyyy-MM-dd"),
      }));
    }
    setEditingEvent(null);
    setIsEventDialogOpen(true);
  };

  const handleOpenEditDialog = (event: AcademyCalendarEvent) => {
    const examSubjects = examSchedulesMap[event.id]?.map(s => ({
      examDate: s.examDate,
      subjects: s.subjects,
      grade: s.grade || "",
      excludedStudentIds: s.excludedStudentIds || [],
    })) || [];
    
    setEventForm({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType as "single" | "period" | "exam",
      startDate: event.startDate,
      endDate: event.endDate || "",
      color: event.color,
      school: event.school || "",
      examSubjects,
    });
    setEditingEvent(event);
    setIsDetailDialogOpen(false);
    setIsEventDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedCenter?.id) {
      toast({ title: "센터를 선택해주세요", variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: "로그인이 필요합니다", variant: "destructive" });
      return;
    }
    if (!eventForm.title.trim()) {
      toast({ title: "일정 제목을 입력해주세요", variant: "destructive" });
      return;
    }
    if (!eventForm.startDate) {
      toast({ title: "시작 날짜를 선택해주세요", variant: "destructive" });
      return;
    }
    if ((eventForm.eventType === "period" || eventForm.eventType === "exam") && !eventForm.endDate) {
      toast({ title: "종료 날짜를 선택해주세요", variant: "destructive" });
      return;
    }

    if (editingEvent) {
      updateMutation.mutate({ ...eventForm, id: editingEvent.id });
    } else {
      createMutation.mutate(eventForm);
    }
  };

  const addExamSubject = () => {
    if (!eventForm.startDate || !eventForm.endDate) return;
    setEventForm(prev => ({
      ...prev,
      examSubjects: [...prev.examSubjects, { examDate: "", subjects: "", grade: "", excludedStudentIds: [] }],
    }));
  };

  const updateExamSubject = (index: number, field: "examDate" | "subjects" | "grade", value: string) => {
    setEventForm(prev => ({
      ...prev,
      examSubjects: prev.examSubjects.map((s, i) => 
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const removeExamSubject = (index: number) => {
    setEventForm(prev => ({
      ...prev,
      examSubjects: prev.examSubjects.filter((_, i) => i !== index),
    }));
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const startDate = parseISO(event.startDate);
      if (event.eventType === "single" || !event.endDate) {
        return isSameDay(date, startDate);
      }
      const endDate = parseISO(event.endDate);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  };

  const getExamSubjectsForDate = (date: Date, eventId: string) => {
    const schedules = examSchedulesMap[eventId] || [];
    const dateStr = format(date, "yyyy-MM-dd");
    // 같은 날짜에 여러 과목 항목이 있을 수 있으므로 모두 합쳐서 반환
    const matched = schedules.filter(s => s.examDate === dateStr);
    if (matched.length === 0) return null;
    const combined = matched
      .map(s => s.subjects)
      .filter(s => s && s.trim().length > 0)
      .join(", ");
    if (!combined) return null;
    return { subjects: combined };
  };

  const eventsForSelectedDate = selectedDate ? getEventsForDate(selectedDate) : [];

  const getEventPositionInfo = (event: AcademyCalendarEvent, date: Date) => {
    if (event.eventType === "single" || !event.endDate) {
      return { isStart: true, isEnd: true, isMiddle: false, isWeekStart: false, isWeekEnd: false };
    }
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    const isStart = isSameDay(date, eventStart);
    const isEnd = isSameDay(date, eventEnd);
    const isMiddle = !isStart && !isEnd;
    
    const dayOfWeek = date.getDay();
    const isWeekStart = dayOfWeek === 0 && !isStart;
    const isWeekEnd = dayOfWeek === 6 && !isEnd;
    
    return { isStart, isEnd, isMiddle, isWeekStart, isWeekEnd };
  };

  const eventSlotMap = useMemo(() => {
    const slotMap: Record<string, Record<string, number>> = {};
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }

    for (const week of weeks) {
      const weekEventSlots: Record<string, number> = {};

      const allWeekEvents = new Set<string>();
      for (const day of week) {
        const dayEvents = getEventsForDate(day);
        dayEvents.forEach(e => allWeekEvents.add(e.id));
      }

      const weekEventsArr = events.filter(e => allWeekEvents.has(e.id));
      weekEventsArr.sort((a, b) => {
        const aDuration = a.endDate 
          ? (parseISO(a.endDate).getTime() - parseISO(a.startDate).getTime()) 
          : 0;
        const bDuration = b.endDate 
          ? (parseISO(b.endDate).getTime() - parseISO(b.startDate).getTime()) 
          : 0;
        if (bDuration !== aDuration) return bDuration - aDuration;
        return a.startDate.localeCompare(b.startDate);
      });

      const eventDayPresence: Record<string, Set<string>> = {};
      for (const ev of weekEventsArr) {
        eventDayPresence[ev.id] = new Set<string>();
        for (const day of week) {
          if (getEventsForDate(day).some(e => e.id === ev.id)) {
            eventDayPresence[ev.id].add(format(day, "yyyy-MM-dd"));
          }
        }
      }

      for (const event of weekEventsArr) {
        const eventDays = eventDayPresence[event.id];
        let slot = 0;
        while (true) {
          const conflict = weekEventsArr.some(other => {
            if (other.id === event.id) return false;
            if (weekEventSlots[other.id] !== slot) return false;
            const otherDays = eventDayPresence[other.id];
            for (const d of Array.from(eventDays)) {
              if (otherDays.has(d)) return true;
            }
            return false;
          });
          if (!conflict) break;
          slot++;
        }
        weekEventSlots[event.id] = slot;
      }

      for (const day of week) {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayEvents = getEventsForDate(day);
        slotMap[dateKey] = {};
        for (const event of dayEvents) {
          slotMap[dateKey][event.id] = weekEventSlots[event.id] ?? 0;
        }
      }
    }
    return slotMap;
  }, [calendarDays, events]);

  const maxSlotsPerWeek = useMemo(() => {
    const result: Record<number, number> = {};
    for (let weekIdx = 0; weekIdx < calendarDays.length / 7; weekIdx++) {
      let weekMax = 0;
      for (let d = 0; d < 7; d++) {
        const day = calendarDays[weekIdx * 7 + d];
        if (!day) continue;
        const dateKey = format(day, "yyyy-MM-dd");
        const daySlots = eventSlotMap[dateKey];
        if (daySlots) {
          const values = Object.values(daySlots);
          const maxSlot = values.length > 0 ? Math.max(...values) + 1 : 0;
          if (maxSlot > weekMax) weekMax = maxSlot;
        }
      }
      result[weekIdx] = weekMax;
    }
    return result;
  }, [calendarDays, eventSlotMap]);

  const getCellMinHeight = (dayIndex: number) => {
    const weekIdx = Math.floor(dayIndex / 7);
    const weekMax = maxSlotsPerWeek[weekIdx] || 0;
    return Math.max(48, 32 + weekMax * 20);
  };

  // 직전 보강 필요 (시험 전날) 목록 - 현재 보고 있는 달 기준
  // 각 시험 일정의 과목 시험일 하루 전 = 직전 보강일
  // 보강일이 현재 달에 속하는 항목만 표시, 날짜순 정렬
  const prepReinforcementList = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    type PrepEntry = {
      prepDate: Date;
      prepDateStr: string;
      examDate: Date;
      examDateStr: string;
      subjects: string;
      eventTitle: string;
      eventColor: string;
      eventId: string;
      scheduleIdx: number;
      scheduleId: string;
      school: string;
      grade: string;
      excludedStudentIds: string[];
    };
    const entries: PrepEntry[] = [];
    const examEvents = examEventsForSchedules;
    examEvents.forEach(event => {
      const schedules = examSchedulesMap[event.id] ?? [];
      schedules.forEach((s, idx) => {
        if (!s.subjects || !s.subjects.trim()) return;
        const examDate = parseISO(s.examDate);
        const prepDate = addDays(examDate, -1);
        if (!isWithinInterval(prepDate, { start: monthStart, end: monthEnd })) return;
        entries.push({
          prepDate,
          prepDateStr: format(prepDate, "yyyy-MM-dd"),
          examDate,
          examDateStr: s.examDate,
          subjects: s.subjects.trim(),
          eventTitle: event.title,
          eventColor: event.color,
          eventId: event.id,
          scheduleIdx: idx,
          scheduleId: s.id,
          school: event.school || "",
          grade: s.grade || "",
          excludedStudentIds: s.excludedStudentIds || [],
        });
      });
    });
    entries.sort((a, b) => {
      if (a.prepDateStr !== b.prepDateStr) return a.prepDateStr.localeCompare(b.prepDateStr);
      return a.eventTitle.localeCompare(b.eventTitle);
    });
    // 날짜별 그룹화
    const grouped = new Map<string, { prepDate: Date; items: PrepEntry[] }>();
    entries.forEach(e => {
      if (!grouped.has(e.prepDateStr)) {
        grouped.set(e.prepDateStr, { prepDate: e.prepDate, items: [] });
      }
      grouped.get(e.prepDateStr)!.items.push(e);
    });
    return Array.from(grouped.values());
  }, [examEventsForSchedules, examSchedulesMap, currentDate]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 md:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            <h1 className="text-xl md:text-2xl font-bold">학원 캘린더</h1>
          </div>
          <ManualButton menuKey="academy-calendar" />
        </div>
        {canManage && (
          <Button onClick={() => handleOpenCreateDialog()} data-testid="button-add-event">
            <Plus className="h-4 w-4 mr-1" />
            일정 추가
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} data-testid="button-prev-month">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg">
              {format(currentDate, "yyyy년 M월", { locale: ko })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} data-testid="button-next-month">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
              <div
                key={day}
                className={cn(
                  "h-8 flex items-center justify-center font-medium text-xs md:text-sm bg-muted",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayOfWeek = day.getDay();
              
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-card p-1 cursor-pointer transition-colors hover:bg-accent/50",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isSelected && "ring-2 ring-primary ring-inset"
                  )}
                  style={{ minHeight: `${getCellMinHeight(index)}px` }}
                  onClick={() => {
                    setSelectedDate(day);
                    setIsDetailDialogOpen(true);
                  }}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                >
                  <div className={cn(
                    "text-xs md:text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                    dayOfWeek === 0 && "text-red-500",
                    dayOfWeek === 6 && "text-blue-500"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="relative" style={{ minHeight: `${dayEvents.length > 0 ? (Math.max(...dayEvents.map(e => (eventSlotMap[format(day, "yyyy-MM-dd")]?.[e.id] ?? 0))) + 1) * 20 : 0}px` }}>
                    {dayEvents.map((event) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const slot = eventSlotMap[dateKey]?.[event.id] ?? 0;
                      const { isStart, isEnd, isMiddle, isWeekStart, isWeekEnd } = getEventPositionInfo(event, day);
                      const examSubject = event.eventType === "exam" ? getExamSubjectsForDate(day, event.id) : null;
                      
                      const showLeftRound = isStart || isWeekStart;
                      const showRightRound = isEnd || isWeekEnd;
                      
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "absolute left-0 right-0 text-[10px] md:text-xs text-white truncate px-1 leading-[18px] md:leading-[20px] h-[18px] md:h-[20px]",
                            showLeftRound && showRightRound && "rounded",
                            showLeftRound && !showRightRound && "rounded-l",
                            showRightRound && !showLeftRound && "rounded-r",
                            !showLeftRound && !showRightRound && "rounded-none"
                          )}
                          style={{
                            top: `${slot * 20}px`,
                            backgroundColor: event.color,
                            marginLeft: showLeftRound ? "0" : "-4px",
                            marginRight: showRightRound ? "0" : "-4px",
                            paddingLeft: showLeftRound ? "4px" : "2px",
                            paddingRight: showRightRound ? "4px" : "2px",
                          }}
                          title={event.title}
                        >
                          {(isStart || isWeekStart) && (
                            <span className="flex items-center gap-0.5">
                              {event.eventType === "exam" && <BookOpen className="h-3 w-3 flex-shrink-0" />}
                              <span className="truncate">
                                {isStart ? event.title : `← ${event.title}`}
                                {examSubject && ` (${examSubject.subjects})`}
                              </span>
                            </span>
                          )}
                          {!isStart && !isWeekStart && examSubject && (
                            <span className="truncate">{examSubject.subjects}</span>
                          )}
                          {!isStart && !isWeekStart && !examSubject && (
                            <span>&nbsp;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {prepReinforcementList.length > 0 && (
        <Card data-testid="card-prep-reinforcement">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" />
              직전 보강 필요 (시험 전날)
              <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-400">
                {format(currentDate, "M월", { locale: ko })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              과목별 시험 전날에 직전 보강이 필요한 항목입니다. 선생님 일정 관리에 활용하세요.
            </p>
            <div className="space-y-2">
              {prepReinforcementList.map(group => (
                <div
                  key={group.prepDate.toISOString()}
                  className="border rounded-md p-2 bg-orange-50/50 dark:bg-orange-950/20"
                  data-testid={`prep-day-${format(group.prepDate, "yyyy-MM-dd")}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {format(group.prepDate, "M월 d일 (EEE)", { locale: ko })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      직전 보강
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((item, idx) => (
                      <li
                        key={`${item.eventId}-${item.scheduleIdx}-${idx}`}
                        className="flex items-start gap-2 text-sm"
                        data-testid={`prep-item-${item.eventId}-${item.scheduleIdx}`}
                      >
                        <span
                          className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.eventColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{item.subjects}</span>
                            {item.school && (
                              <Badge variant="outline" className="text-xs" data-testid={`badge-prep-school-${item.scheduleId}`}>{item.school}</Badge>
                            )}
                            {item.grade && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-prep-grade-${item.scheduleId}`}>{item.grade}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.eventTitle} · 시험 {format(item.examDate, "M/d (EEE)", { locale: ko })}
                          </div>
                        </div>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 shrink-0"
                            onClick={() => setRosterItem({ scheduleId: item.scheduleId, school: item.school, grade: item.grade, subjects: item.subjects })}
                            data-testid={`button-prep-roster-${item.scheduleId}`}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" />
                            명단
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })}
            </DialogTitle>
            <DialogDescription>해당 날짜의 일정 목록</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {eventsForSelectedDate.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">등록된 일정이 없습니다</p>
            ) : (
              eventsForSelectedDate.map(event => {
                const examSubject = event.eventType === "exam" && selectedDate 
                  ? getExamSubjectsForDate(selectedDate, event.id)
                  : null;

                // 시험 일정 전체 과목/날짜 목록 (날짜순 정렬, 과목이 비어있지 않은 항목만)
                const allExamSchedules = event.eventType === "exam"
                  ? (examSchedulesMap[event.id] ?? [])
                      .filter(s => s.subjects && s.subjects.trim().length > 0)
                      .slice()
                      .sort((a, b) => a.examDate.localeCompare(b.examDate))
                  : [];

                return (
                  <Card key={event.id} className="relative">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                      style={{ backgroundColor: event.color }}
                    />
                    <CardContent className="p-3 pl-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{event.title}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {EVENT_TYPES.find(t => t.value === event.eventType)?.label}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mb-1">{event.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {event.endDate 
                              ? `${event.startDate} ~ ${event.endDate}`
                              : event.startDate
                            }
                          </p>
                          {allExamSchedules.length > 0 ? (
                            <div className="mt-2 p-2 bg-muted rounded text-sm space-y-0.5">
                              <div className="font-medium">시험 과목</div>
                              {allExamSchedules.map((s, idx) => {
                                const d = parseISO(s.examDate);
                                const isSelected = selectedDate && isSameDay(d, selectedDate);
                                return (
                                  <div
                                    key={`${s.examDate}-${idx}`}
                                    className={cn(
                                      "flex items-baseline gap-2",
                                      isSelected && "font-semibold"
                                    )}
                                    data-testid={`text-exam-subject-${event.id}-${idx}`}
                                  >
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {format(d, "M/d (EEE)", { locale: ko })}
                                    </span>
                                    <span>{s.subjects}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : examSubject ? (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">시험 과목: </span>
                              {examSubject.subjects}
                            </div>
                          ) : null}
                        </div>
                        {canManage && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleOpenEditDialog(event)}
                              data-testid={`button-edit-event-${event.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteMutation.mutate(event.id)}
                              data-testid={`button-delete-event-${event.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
          {canManage && selectedDate && (
            <DialogFooter>
              <Button onClick={() => handleOpenCreateDialog(selectedDate)} data-testid="button-add-event-from-date">
                <Plus className="h-4 w-4 mr-1" />
                이 날짜에 일정 추가
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "일정 수정" : "일정 추가"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "일정 정보를 수정합니다" : "새로운 일정을 등록합니다"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>일정 유형</Label>
              <Select
                value={eventForm.eventType}
                onValueChange={(v) => setEventForm(prev => ({ 
                  ...prev, 
                  eventType: v as "single" | "period" | "exam",
                  endDate: v === "single" ? "" : prev.endDate,
                  examSubjects: v === "exam" ? prev.examSubjects : [],
                }))}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>일정 제목</Label>
              <Input
                value={eventForm.title}
                onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="일정 제목 입력"
                data-testid="input-event-title"
              />
            </div>

            <div>
              <Label>설명 (선택)</Label>
              <Textarea
                value={eventForm.description}
                onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="일정 설명"
                rows={2}
                data-testid="input-event-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{eventForm.eventType === "single" ? "날짜" : "시작일"}</Label>
                <Input
                  type="date"
                  value={eventForm.startDate}
                  onChange={e => setEventForm(prev => ({ ...prev, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              {eventForm.eventType !== "single" && (
                <div>
                  <Label>종료일</Label>
                  <Input
                    type="date"
                    value={eventForm.endDate}
                    onChange={e => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                    min={eventForm.startDate}
                    data-testid="input-end-date"
                  />
                </div>
              )}
            </div>

            <div>
              <Label>색상</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {EVENT_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      eventForm.color === color.value && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setEventForm(prev => ({ ...prev, color: color.value }))}
                    title={color.label}
                    data-testid={`button-color-${color.value}`}
                  />
                ))}
              </div>
            </div>

            {eventForm.eventType === "exam" && (
              <div>
                <Label>학교명 (시험 대상 학교)</Label>
                <SchoolCombobox
                  value={eventForm.school}
                  options={schoolOptions}
                  onChange={(v) => setEventForm(prev => ({ ...prev, school: v }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  등록된 학생들의 학교 중에서 선택하거나 검색하세요. 직전 보강 명단을 학교·학년 기준으로 조회할 때 사용됩니다.
                </p>
              </div>
            )}

            {eventForm.eventType === "exam" && eventForm.startDate && eventForm.endDate && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>날짜별 시험 과목</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addExamSubject}
                    data-testid="button-add-exam-subject"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    과목 추가
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  시험 기간 내 날짜별로 과목을 설정합니다. 비어있는 날짜도 허용됩니다.
                </p>
                {eventForm.examSubjects.map((subject, index) => (
                  <div key={index} className="flex flex-wrap gap-2 items-center">
                    <Input
                      type="date"
                      value={subject.examDate}
                      onChange={e => updateExamSubject(index, "examDate", e.target.value)}
                      min={eventForm.startDate}
                      max={eventForm.endDate}
                      className="w-40"
                      data-testid={`input-exam-date-${index}`}
                    />
                    <Select
                      value={subject.grade || ""}
                      onValueChange={(v) => updateExamSubject(index, "grade", v)}
                    >
                      <SelectTrigger className="w-24" data-testid={`select-exam-grade-${index}`}>
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={subject.subjects}
                      onChange={e => updateExamSubject(index, "subjects", e.target.value)}
                      placeholder="시험 과목 (예: 국어, 영어)"
                      className="flex-1 min-w-[140px]"
                      data-testid={`input-exam-subjects-${index}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeExamSubject(index)}
                      className="shrink-0"
                      data-testid={`button-remove-exam-subject-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-event"
            >
              {editingEvent ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rosterItem} onOpenChange={(o) => !o && setRosterItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              직전 보강 명단
            </DialogTitle>
            <DialogDescription>
              {rosterItem && [rosterItem.school, rosterItem.grade].filter(Boolean).join(" · ")}
              {rosterItem?.subjects ? ` · ${rosterItem.subjects}` : ""}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!rosterItem) return null;
            let liveSchedule: ExamSubjectSchedule | undefined;
            for (const list of Object.values(examSchedulesMap)) {
              liveSchedule = list.find(s => s.id === rosterItem.scheduleId);
              if (liveSchedule) break;
            }
            const excluded = new Set(liveSchedule?.excludedStudentIds || []);
            const roster = centerStudents
              .filter(s => s.role === UserRole.STUDENT)
              .filter(s => {
                const schoolOk = !rosterItem.school || (s.school || "").trim() === rosterItem.school.trim();
                const gradeOk = !rosterItem.grade || normalizeGrade(s.grade) === normalizeGrade(rosterItem.grade);
                return schoolOk && gradeOk;
              })
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            const includedCount = roster.filter(s => !excluded.has(s.id)).length;
            const toggle = (studentId: string) => {
              const next = new Set(excluded);
              if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
              updateExclusionMutation.mutate({ scheduleId: rosterItem.scheduleId, excludedStudentIds: Array.from(next) });
            };
            return (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  체크를 해제하면 해당 학생은 시험을 보지 않는 것으로 간주되어 보강 명단에서 제외됩니다.
                </p>
                <div className="text-sm font-medium" data-testid="text-roster-count">
                  응시 {includedCount}명 / 전체 {roster.length}명
                </div>
                <div className="space-y-1 max-h-[55vh] overflow-y-auto">
                  {roster.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm" data-testid="text-no-roster-students">
                      해당 학교·학년의 학생이 없습니다
                    </p>
                  ) : (
                    roster.map(s => {
                      const isExcluded = excluded.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer",
                            isExcluded && "opacity-50"
                          )}
                          data-testid={`roster-student-${s.id}`}
                        >
                          <Checkbox
                            checked={!isExcluded}
                            onCheckedChange={() => toggle(s.id)}
                            disabled={updateExclusionMutation.isPending}
                            data-testid={`checkbox-roster-${s.id}`}
                          />
                          <span className={cn("text-sm flex-1 min-w-0 truncate", isExcluded && "line-through")}>
                            {s.name}
                          </span>
                          {s.school && (
                            <span className="text-xs text-muted-foreground truncate max-w-[40%]">{s.school}</span>
                          )}
                          {s.grade && (
                            <Badge variant="outline" className="text-xs shrink-0">{normalizeGrade(s.grade)}</Badge>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRosterItem(null)} data-testid="button-close-roster">
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
