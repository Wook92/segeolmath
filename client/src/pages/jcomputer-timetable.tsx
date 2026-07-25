import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { Plus, Users, Pencil, Trash2, UserPlus, X, Printer, Download, Filter, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, getAssistantTeacherIds, isAssistantTeacher, type Class, type User, type Enrollment } from "@shared/schema";
import { cn } from "@/lib/utils";

// Custom Time Picker Component
function TimePicker({ value, onChange, className }: { 
  value: string; 
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(":").map(Number);
  
  const formatDisplay = (hour: number, min: number) => {
    const period = hour < 12 ? "오전" : "오후";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${period} ${displayHour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border bg-background hover:bg-accent/50 transition-colors",
            className
          )}
        >
          {formatDisplay(h, m)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex gap-4">
          {/* Hour selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">시</p>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 16 }, (_, i) => i + 7).map((hour) => (
                <Button
                  key={hour}
                  type="button"
                  variant={h === hour ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8 w-9"
                  onClick={() => {
                    onChange(`${hour.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
                  }}
                >
                  {hour}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Minute selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 text-center">분</p>
            <div className="grid grid-cols-3 gap-1">
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
                <Button
                  key={min}
                  type="button"
                  variant={m === min ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-8 w-9"
                  onClick={() => {
                    onChange(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
                  }}
                >
                  {min.toString().padStart(2, "0")}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

const DEFAULT_START_HOUR = 9;
const END_HOUR = 23;

function generateTimeSlots(classes: Class[]): string[] {
  let minHour = DEFAULT_START_HOUR;
  classes.forEach((cls) => {
    const startTimes: string[] = [cls.startTime];
    if (cls.schedule) {
      try {
        const scheduleArray = JSON.parse(cls.schedule);
        scheduleArray.forEach((s: any) => { if (s.startTime) startTimes.push(s.startTime); });
      } catch {}
    }
    startTimes.forEach((t) => {
      const h = parseInt(t.split(":")[0], 10);
      if (!isNaN(h) && h < minHour) minHour = h;
    });
  });
  const totalSlots = (END_HOUR - minHour) * 4;
  return Array.from({ length: totalSlots }, (_, i) => {
    const hour = Math.floor(i / 4) + minHour;
    const min = (i % 4) * 15;
    return `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  });
}

const CLASS_COLORS = [
  "#93C5FD", "#86EFAC", "#FCD34D", "#FCA5A5", "#C4B5FD", "#F9A8D4",
  "#67E8F9", "#BEF264", "#FDBA74", "#A5B4FC", "#D8B4FE", "#99F6E4",
  "#FDE68A", "#A7F3D0", "#FBCFE8", "#BAE6FD", "#E9D5FF", "#FED7AA",
  "#BBF7D0", "#FECACA", "#DDD6FE", "#A5F3FC", "#FEF08A", "#C7D2FE",
];

// All Teachers Timetable Grid - shows all classes with horizontal scrolling
function AllTeachersTimetableGrid({ classes, onClassClick, teacherMap, hideTimeColumn = false, allClasses }: { 
  classes: Class[]; 
  onClassClick?: (cls: Class) => void;
  teacherMap?: Map<string, User>;
  hideTimeColumn?: boolean;
  allClasses?: Class[];
}) {
  const TIME_SLOTS = useMemo(() => generateTimeSlots(allClasses || classes), [allClasses, classes]);
  const getScheduleForDay = (cls: Class, day: string) => {
    if (cls.schedule) {
      try {
        const scheduleArray = JSON.parse(cls.schedule);
        const daySchedule = scheduleArray.find((s: any) => s.day === day);
        if (daySchedule) {
          return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
        }
      } catch {}
    }
    return { startTime: cls.startTime, endTime: cls.endTime };
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  // Assign column indices to classes using sweep-line algorithm
  const assignColumnIndices = (day: string) => {
    const dayClasses = classes.filter((cls) => cls.days.includes(day));
    if (dayClasses.length === 0) return { assignments: new Map<string, number>(), maxColumns: 1 };
    
    // Create events for sweep-line
    const events: { time: number; type: 'start' | 'end'; classId: string; cls: Class }[] = [];
    dayClasses.forEach((cls) => {
      const { startTime, endTime } = getScheduleForDay(cls, day);
      events.push({ time: timeToMinutes(startTime), type: 'start', classId: cls.id, cls });
      events.push({ time: timeToMinutes(endTime), type: 'end', classId: cls.id, cls });
    });
    
    // Sort by time, with 'end' before 'start' at same time
    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.type === 'end' ? -1 : 1;
    });
    
    const assignments = new Map<string, number>();
    const activeColumns: (string | null)[] = [];
    let maxColumns = 1;
    
    events.forEach((event) => {
      if (event.type === 'start') {
        // Find first available column
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
        // Free up the column
        const columnIdx = assignments.get(event.classId);
        if (columnIdx !== undefined && columnIdx < activeColumns.length) {
          activeColumns[columnIdx] = null;
        }
      }
    });
    
    return { assignments, maxColumns };
  };

  // Pre-calculate column assignments for all days
  const dayData = DAYS.map((day) => {
    const { assignments, maxColumns } = assignColumnIndices(day.key);
    return { ...day, assignments, maxColumns };
  });

  const getClassDuration = (cls: Class, day: string) => {
    const { startTime, endTime } = getScheduleForDay(cls, day);
    const durationMin = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(1, Math.ceil(durationMin / 15));
  };

  // Round time to nearest 15-minute slot (floor)
  const roundToSlot = (minutes: number) => Math.floor(minutes / 15) * 15;
  
  const isClassStart = (cls: Class, day: string, time: string) => {
    const { startTime } = getScheduleForDay(cls, day);
    const startMin = timeToMinutes(startTime);
    const slotMin = timeToMinutes(time);
    // Check if this slot contains the class start time (rounded down to nearest 15 min)
    return roundToSlot(startMin) === slotMin;
  };

  const getClassesForSlot = (day: string, time: string) => {
    return classes.filter((cls) => {
      if (!cls.days.includes(day)) return false;
      const { startTime, endTime } = getScheduleForDay(cls, day);
      const slotMin = timeToMinutes(time);
      const startMin = timeToMinutes(startTime);
      const endMin = timeToMinutes(endTime);
      // Include slot if it contains any part of the class time
      return slotMin >= roundToSlot(startMin) && slotMin < endMin;
    });
  };

  // Track which classes are already rendered per day
  const renderedClasses = new Set<string>();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header row with day labels */}
        <div className="flex border-b">
          {!hideTimeColumn && (
            <div className="w-16 shrink-0 h-7 flex items-center justify-center font-medium text-xs bg-muted rounded-l">
              시간
            </div>
          )}
          {dayData.map((day) => (
            <div
              key={day.key}
              className="h-7 flex items-center justify-center font-medium text-xs bg-muted border-l"
              style={{ width: `${Math.max(120, day.maxColumns * 100)}px`, minWidth: `${Math.max(120, day.maxColumns * 100)}px` }}
            >
              {day.label}
            </div>
          ))}
        </div>

        {/* Time slots */}
        {TIME_SLOTS.map((time) => {
          const isFullHour = time.endsWith(":00");
          const isHalfHour = time.endsWith(":30");
          
          return (
            <div key={time} className="flex">
              {/* Time label */}
              {!hideTimeColumn && (
                <div className={cn(
                  "w-16 shrink-0 h-3 flex items-center justify-center text-[10px] text-muted-foreground border-r",
                  isFullHour ? "border-b" : "border-b border-dashed border-border/30",
                  !isFullHour && "opacity-50"
                )}>
                  {isFullHour && time}
                </div>
              )}
              
              {/* Day columns */}
              {dayData.map((day) => {
                const slotClasses = getClassesForSlot(day.key, time);
                const startingClasses = slotClasses.filter(
                  (c) => isClassStart(c, day.key, time) && !renderedClasses.has(`${c.id}-${day.key}`)
                );
                
                // Mark classes as rendered
                startingClasses.forEach((c) => renderedClasses.add(`${c.id}-${day.key}`));

                const columnWidth = Math.max(120, day.maxColumns * 100);
                const classWidth = day.maxColumns > 1 ? (columnWidth / day.maxColumns) - 2 : columnWidth - 4;

                return (
                  <div
                    key={`${day.key}-${time}`}
                    className={cn(
                      "h-3 border-l relative",
                      isHalfHour ? "border-b border-dashed border-border/50" : "border-b"
                    )}
                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
                  >
                    {startingClasses.map((cls) => {
                      const duration = getClassDuration(cls, day.key);
                      const { startTime, endTime } = getScheduleForDay(cls, day.key);
                      const columnIdx = day.assignments.get(cls.id) ?? 0;
                      
                      return (
                        <button
                          key={cls.id}
                          onClick={() => onClassClick?.(cls)}
                          className="absolute rounded p-0.5 text-left text-[9px] font-medium overflow-hidden cursor-pointer transition-all hover:brightness-95 active:brightness-90"
                          style={{
                            backgroundColor: cls.color,
                            height: `${duration * 12}px`,
                            width: `${classWidth}px`,
                            left: `${columnIdx * (classWidth + 2) + 2}px`,
                            zIndex: 10,
                            color: "#1a1a1a",
                          }}
                          data-testid={`class-slot-all-${cls.id}`}
                        >
                          <p className="truncate font-semibold leading-none text-[8px]">{cls.name} {cls.subject}반</p>
                          <p className="text-[7px] opacity-70 truncate leading-none">
                            {startTime}-{endTime}
                          </p>
                          {cls.teacherId && teacherMap?.get(cls.teacherId) && (
                            <p className="text-[7px] opacity-70 truncate leading-none">
                              {teacherMap.get(cls.teacherId)?.name}
                            </p>
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

function TimetableGrid({ classes, onClassClick, isStudent = false, teacherMap, allClasses }: { 
  classes: Class[]; 
  onClassClick?: (cls: Class) => void;
  isStudent?: boolean;
  teacherMap?: Map<string, User>;
  allClasses?: Class[];
}) {
  const TIME_SLOTS = useMemo(() => generateTimeSlots(allClasses || classes), [allClasses, classes]);
  const getScheduleForDay = (cls: Class, day: string) => {
    if (cls.schedule) {
      try {
        const scheduleArray = JSON.parse(cls.schedule);
        const daySchedule = scheduleArray.find((s: any) => s.day === day);
        if (daySchedule) {
          return { startTime: daySchedule.startTime, endTime: daySchedule.endTime };
        }
      } catch {}
    }
    return { startTime: cls.startTime, endTime: cls.endTime };
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  // Round time to nearest 15-minute slot (floor)
  const roundToSlot = (minutes: number) => Math.floor(minutes / 15) * 15;

  const getClassesForSlot = (day: string, time: string) => {
    return classes.filter((cls) => {
      if (!cls.days.includes(day)) return false;
      const { startTime, endTime } = getScheduleForDay(cls, day);
      const slotMin = timeToMinutes(time);
      const startMin = timeToMinutes(startTime);
      const endMin = timeToMinutes(endTime);
      // Include slot if it contains any part of the class time
      return slotMin >= roundToSlot(startMin) && slotMin < endMin;
    });
  };

  const isClassStart = (cls: Class, day: string, time: string) => {
    const { startTime } = getScheduleForDay(cls, day);
    const startMin = timeToMinutes(startTime);
    const slotMin = timeToMinutes(time);
    // Check if this slot contains the class start time (rounded down to nearest 15 min)
    return roundToSlot(startMin) === slotMin;
  };

  const getClassDuration = (cls: Class, day: string) => {
    const { startTime, endTime } = getScheduleForDay(cls, day);
    const durationMin = timeToMinutes(endTime) - timeToMinutes(startTime);
    return Math.max(1, Math.ceil(durationMin / 15));
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 md:gap-1">
        {DAYS.map((day) => (
          <div
            key={day.key}
            className="h-8 md:h-12 flex items-center justify-center font-medium text-[10px] md:text-sm bg-muted rounded-sm md:rounded-md"
          >
            {day.label}
          </div>
        ))}

        {TIME_SLOTS.map((time) => {
          const isFullHour = time.endsWith(":00");
          return [
            ...DAYS.map((day) => {
              const slotClasses = getClassesForSlot(day.key, time);
              const startingClasses = slotClasses.filter((c) => isClassStart(c, day.key, time));

              return (
                <div
                  key={`${day.key}-${time}`}
                  className={cn(
                    "h-4 md:h-4 border-x border-border/30 md:border-border/50 relative",
                    isFullHour ? "border-t" : "border-t border-dashed border-border/30"
                  )}
                >
                  {startingClasses.map((cls) => {
                    const duration = getClassDuration(cls, day.key);
                    const { startTime, endTime } = getScheduleForDay(cls, day.key);
                    return (
                      <button
                        key={cls.id}
                        onClick={() => onClassClick?.(cls)}
                        className="absolute left-0 right-0 top-0 rounded-sm md:rounded-md p-0.5 md:p-1 text-left text-[8px] md:text-xs font-medium overflow-hidden cursor-pointer transition-all hover:brightness-95 active:brightness-90"
                        style={{
                          backgroundColor: cls.color,
                          height: `calc(${duration * 100}% + ${(duration - 1) * 1}px)`,
                          zIndex: 10,
                          color: "#1a1a1a",
                        }}
                        data-testid={`class-slot-${cls.id}`}
                      >
                        <p className="truncate font-semibold leading-tight">{cls.name}</p>
                        <p className="text-[7px] md:text-[10px] opacity-80 truncate">{cls.subject}반</p>
                        <p className="text-[7px] md:text-[10px] opacity-70 hidden md:block">
                          {startTime}-{endTime}
                        </p>
                        {cls.teacherId && teacherMap?.get(cls.teacherId) && (
                          <p className="text-[7px] md:text-[10px] opacity-70 truncate hidden md:block">
                            {teacherMap.get(cls.teacherId)?.name}
                          </p>
                        )}
                        {cls.classType !== "regular" && !isStudent && (
                          <Badge variant="secondary" className="text-[7px] md:text-[9px] mt-0.5 bg-white/50 hidden md:inline-flex">
                            {cls.classType === "assessment" ? "평가" : cls.classType === "high_clinic" ? "고등클리닉" : "중등클리닉"}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

function CreateClassDialog({ 
  teachers, 
  onClose, 
  editingClass,
  existingClasses = []
}: { 
  teachers: User[]; 
  onClose: () => void;
  editingClass?: Class | null;
  existingClasses?: Class[];
}) {
  const { selectedCenter, user } = useAuth();
  const { toast } = useToast();
  const [useDifferentTimes, setUseDifferentTimes] = useState(false);
  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const defaultTeacherId = isTeacherOnly ? user.id : (editingClass?.teacherId || "");
  const [formData, setFormData] = useState({
    name: editingClass?.name || "",
    subject: editingClass?.subject || "",
    classType: editingClass?.classType || "regular",
    classLevel: (editingClass as any)?.classLevel || "middle",
    teacherId: defaultTeacherId,
    assistantTeacherIds: editingClass ? getAssistantTeacherIds(editingClass) : [] as string[],
    classroom: editingClass?.classroom || "",
    days: editingClass?.days || [] as string[],
    startTime: editingClass?.startTime || "14:00",
    endTime: editingClass?.endTime || "15:00",
    color: editingClass?.color || CLASS_COLORS[0],
  });
  const [dayTimes, setDayTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingClass) {
        return apiRequest("PATCH", `/api/classes/${editingClass.id}`, data);
      }
      return apiRequest("POST", "/api/classes", data);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      toast({ title: editingClass ? "수업이 수정되었습니다" : "수업이 생성되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: editingClass ? "수업 수정에 실패했습니다" : "수업 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      toast({ title: "요일을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!formData.teacherId) {
      toast({ title: "선생님을 선택해주세요", variant: "destructive" });
      return;
    }

    if (useDifferentTimes) {
      for (const day of formData.days) {
        const st = dayTimes[day]?.startTime || formData.startTime;
        const et = dayTimes[day]?.endTime || formData.endTime;
        if (st >= et) {
          const dayLabel = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" }[day] || day;
          toast({ title: "시간 입력 오류", description: `${dayLabel}요일: 종료 시각(${et})이 시작 시각(${st})보다 빠릅니다.`, variant: "destructive" });
          return;
        }
      }
    } else {
      if (formData.startTime >= formData.endTime) {
        toast({ title: "시간 입력 오류", description: `종료 시각(${formData.endTime})이 시작 시각(${formData.startTime})보다 빠르거나 같습니다.`, variant: "destructive" });
        return;
      }
    }

    let schedule = null;
    if (useDifferentTimes) {
      schedule = JSON.stringify(
        formData.days.map((day) => ({
          day,
          startTime: dayTimes[day]?.startTime || formData.startTime,
          endTime: dayTimes[day]?.endTime || formData.endTime,
        }))
      );
    }

    const cleanedAssistantIds = Array.from(new Set(
      (formData.assistantTeacherIds || []).filter((aid) => aid && aid !== formData.teacherId)
    ));
    mutation.mutate({
      ...formData,
      assistantTeacherIds: cleanedAssistantIds,
      assistantTeacherId: cleanedAssistantIds[0] || null,
      centerId: selectedCenter?.id,
      schedule,
    });
  };

  const toggleDay = (day: string) => {
    setFormData((p) => ({
      ...p,
      days: p.days.includes(day)
        ? p.days.filter((d) => d !== day)
        : [...p.days, day],
    }));
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">수업명</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="예: 중2-2"
            required
            data-testid="input-class-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">반이름</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
            placeholder="예: 화목S반 or 개념S반"
            required
            data-testid="input-class-subject"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>수업 유형</Label>
          <Select
            value={formData.classType}
            onValueChange={(v) => setFormData((p) => ({ ...p, classType: v }))}
          >
            <SelectTrigger data-testid="select-class-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">정규 수업</SelectItem>
              <SelectItem value="assessment">평가 수업</SelectItem>
              <SelectItem value="high_clinic">고등클리닉</SelectItem>
              <SelectItem value="middle_clinic">중등클리닉</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>수업 레벨</Label>
          <Select
            value={formData.classLevel}
            onValueChange={(v) => setFormData((p) => ({ ...p, classLevel: v }))}
          >
            <SelectTrigger data-testid="select-class-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kindergarten">유치부</SelectItem>
              <SelectItem value="elementary">초등</SelectItem>
              <SelectItem value="middle">중등</SelectItem>
              <SelectItem value="high">고등</SelectItem>
              <SelectItem value="adult">성인</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>담당 선생님</Label>
          {isTeacherOnly ? (
            <div className="flex items-center h-9 px-3 border rounded-md bg-muted text-sm">
              {user.name} 선생님
            </div>
          ) : (
            <Select
              value={formData.teacherId}
              onValueChange={(v) => setFormData((p) => ({ ...p, teacherId: v }))}
            >
              <SelectTrigger data-testid="select-teacher">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} 선생님
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label>부담임 (다중 선택 가능)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                data-testid="button-assistant-teachers"
              >
                <span className="truncate">
                  {formData.assistantTeacherIds.length === 0
                    ? "없음"
                    : teachers
                        .filter(t => formData.assistantTeacherIds.includes(t.id))
                        .map(t => `${t.name} 선생님`)
                        .join(", ")}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 max-h-72 overflow-y-auto" align="start">
              {teachers.filter(t => t.id !== formData.teacherId).length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">선택 가능한 선생님이 없습니다</div>
              ) : (
                teachers.filter(t => t.id !== formData.teacherId).map((t) => {
                  const checked = formData.assistantTeacherIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover-elevate active-elevate-2 cursor-pointer text-sm"
                      data-testid={`checkbox-assistant-teacher-${t.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setFormData((p) => ({
                            ...p,
                            assistantTeacherIds: e.target.checked
                              ? [...p.assistantTeacherIds, t.id]
                              : p.assistantTeacherIds.filter((id) => id !== t.id),
                          }));
                        }}
                      />
                      <span>{t.name} 선생님</span>
                    </label>
                  );
                })
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="classroom">강의실</Label>
        <Input
          id="classroom"
          value={formData.classroom}
          onChange={(e) => setFormData((p) => ({ ...p, classroom: e.target.value }))}
          placeholder="예: 2관 1강의실"
          data-testid="input-classroom"
        />
      </div>

      <div className="space-y-2">
        <Label>요일 선택</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <Button
              key={day.key}
              type="button"
              variant={formData.days.includes(day.key) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day.key)}
              data-testid={`day-${day.key}`}
            >
              {day.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수업 시간</Label>
          {formData.days.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useDifferentTimes}
                onChange={(e) => setUseDifferentTimes(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              요일별 다른 시간
            </label>
          )}
        </div>

        {useDifferentTimes && formData.days.length > 1 ? (
          <div className="space-y-2 border rounded-md p-3">
            {formData.days.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="w-8 text-sm font-medium">
                  {DAYS.find((d) => d.key === day)?.label}
                </span>
                <TimePicker
                  value={dayTimes[day]?.startTime || formData.startTime}
                  onChange={(v) =>
                    setDayTimes((p) => ({
                      ...p,
                      [day]: { ...p[day], startTime: v, endTime: p[day]?.endTime || formData.endTime },
                    }))
                  }
                />
                <span className="text-muted-foreground">~</span>
                <TimePicker
                  value={dayTimes[day]?.endTime || formData.endTime}
                  onChange={(v) =>
                    setDayTimes((p) => ({
                      ...p,
                      [day]: { ...p[day], endTime: v, startTime: p[day]?.startTime || formData.startTime },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <TimePicker
              value={formData.startTime}
              onChange={(v) => setFormData((p) => ({ ...p, startTime: v }))}
            />
            <span className="text-muted-foreground">~</span>
            <TimePicker
              value={formData.endTime}
              onChange={(v) => setFormData((p) => ({ ...p, endTime: v }))}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>색상</Label>
        <div className="flex flex-wrap gap-2 ml-1">
          {CLASS_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform",
                formData.color === color ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setFormData((p) => ({ ...p, color }))}
              data-testid={`color-${color}`}
            />
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-create-class">
          {mutation.isPending ? (editingClass ? "수정 중..." : "생성 중...") : (editingClass ? "수업 수정" : "수업 생성")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ClassWithTeacher extends Class {
  teacher?: User;
}

function EnrollDialog({ classItem, onClose }: { classItem: ClassWithTeacher; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: enrollments } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id,
  });

  const isEnrolled = enrollments?.some((e) => e.classId === classItem.id);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/enrollments", {
        studentId: user?.id,
        classId: classItem.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "수업 신청이 완료되었습니다" });
      onClose();
    },
    onError: () => {
      toast({
        title: "시간이 겹쳐 수업을 추가할 수 없습니다",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-12 rounded-full"
          style={{ backgroundColor: classItem.color }}
        />
        <div>
          <h3 className="font-semibold text-lg">{classItem.name}</h3>
          <p className="text-muted-foreground">{classItem.subject}반</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">요일</span>
          <span>{classItem.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">시간</span>
          <span>{classItem.startTime} - {classItem.endTime}</span>
        </div>
        {classItem.teacher && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">선생님</span>
            <span>{classItem.teacher.name} 선생님</span>
          </div>
        )}
        {classItem.classroom && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">강의실</span>
            <span>{classItem.classroom}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        {isEnrolled ? (
          <Button disabled variant="secondary">
            이미 신청됨
          </Button>
        ) : (
          <Button
            onClick={() => enrollMutation.mutate()}
            disabled={enrollMutation.isPending}
            data-testid="button-enroll"
          >
            {enrollMutation.isPending ? "신청 중..." : "수업 신청"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

function EditClassDialog({ 
  classItem, 
  teachers,
  onClose,
  existingClasses = []
}: { 
  classItem: ClassWithTeacher; 
  teachers: User[];
  onClose: () => void;
  existingClasses?: Class[];
}) {
  const { toast } = useToast();
  const { selectedCenter, user } = useAuth();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showEnrollStudents, setShowEnrollStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all students in the class's center (not selectedCenter, which may differ)
  const { data: centerStudents = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${classItem.centerId}/students`],
    enabled: !!classItem.centerId && showEnrollStudents,
  });

  // Fetch current enrollments for this class
  const { data: classEnrollments = [] } = useQuery<any[]>({
    queryKey: [`/api/classes/${classItem.id}/enrollments`],
    enabled: showEnrollStudents,
  });

  const enrolledStudentIds = new Set(classEnrollments.map((e) => e.studentId));

  const filteredStudents = centerStudents.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.phone?.includes(searchQuery)
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/classes/${classItem.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/enrollments");
      invalidateQueriesStartingWith("/api/students");
      toast({ title: "수업이 삭제되었습니다" });
      onClose();
    },
    onError: () => {
      toast({ title: "수업 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("POST", "/api/enrollments", {
        studentId,
        classId: classItem.id,
      });
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "학생이 수업에 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "등록에 실패했습니다. 시간이 겹칠 수 있습니다.", variant: "destructive" });
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      return apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/classes");
      invalidateQueriesStartingWith("/api/students");
      invalidateQueriesStartingWith("/api/homework");
      invalidateQueriesStartingWith("/api/assessments");
      toast({ title: "학생이 수업에서 제외되었습니다" });
    },
    onError: () => {
      toast({ title: "제외에 실패했습니다", variant: "destructive" });
    },
  });

  if (showEditForm) {
    return (
      <CreateClassDialog 
        teachers={teachers} 
        onClose={onClose} 
        editingClass={classItem}
        existingClasses={existingClasses}
      />
    );
  }

  if (showEnrollStudents) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">학생 등록 관리</h3>
          <Button variant="ghost" size="icon" onClick={() => setShowEnrollStudents(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: classItem.color }} />
          <div>
            <p className="font-medium text-sm">{classItem.name}</p>
            <p className="text-xs text-muted-foreground">{classItem.subject}반</p>
          </div>
        </div>

        <Input
          placeholder="학생 이름 또는 전화번호 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-student"
        />

        {/* Currently enrolled students */}
        {classEnrollments.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">등록된 학생 ({classEnrollments.length}명)</Label>
            <ScrollArea className="h-32 border rounded-md p-2">
              <div className="space-y-1">
                {classEnrollments.map((enrollment) => {
                  const student = centerStudents.find((s) => s.id === enrollment.studentId);
                  return (
                    <div key={enrollment.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <span className="text-sm">{student?.name || "알 수 없음"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        onClick={() => unenrollMutation.mutate(enrollment.id)}
                        disabled={unenrollMutation.isPending}
                        data-testid={`button-unenroll-${enrollment.studentId}`}
                      >
                        제외
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Available students to enroll */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">등록 가능한 학생</Label>
          <ScrollArea className="h-48 border rounded-md p-2">
            <div className="space-y-1">
              {filteredStudents
                .filter((student) => !enrolledStudentIds.has(student.id))
                .map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                    <div>
                      <span className="text-sm font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{student.grade}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => enrollMutation.mutate(student.id)}
                      disabled={enrollMutation.isPending}
                      data-testid={`button-enroll-${student.id}`}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      등록
                    </Button>
                  </div>
                ))}
              {filteredStudents.filter((s) => !enrolledStudentIds.has(s.id)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? "검색 결과가 없습니다" : "모든 학생이 등록되었습니다"}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEnrollStudents(false)}>
            완료
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-12 rounded-full"
          style={{ backgroundColor: classItem.color }}
        />
        <div>
          <h3 className="font-semibold text-lg">{classItem.name}</h3>
          <p className="text-muted-foreground">{classItem.subject}반</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">요일</span>
          <span>{classItem.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">시간</span>
          <span>{classItem.startTime} - {classItem.endTime}</span>
        </div>
        {classItem.teacher && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">선생님</span>
            <span>{classItem.teacher.name} 선생님</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">유형</span>
          <Badge variant="outline">
            {classItem.classType === "regular" ? "정규 수업" : classItem.classType === "assessment" ? "평가 수업" : classItem.classType === "high_clinic" ? "고등클리닉" : "중등클리닉"}
          </Badge>
        </div>
      </div>

      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowEnrollStudents(true)}
          data-testid="button-manage-students"
        >
          <Users className="h-4 w-4 mr-1" />
          학생 관리
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowEditForm(true)}
          data-testid="button-edit-class"
        >
          <Pencil className="h-4 w-4 mr-1" />
          수정
        </Button>
        <Button 
          variant="destructive" 
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          data-testid="button-delete-class"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          삭제
        </Button>
      </DialogFooter>
    </div>
  );
}

// Day labels for attendance sheet
const ATTENDANCE_DAYS = [
  { key: "all", label: "전체" },
  { key: "mon", label: "월요일" },
  { key: "tue", label: "화요일" },
  { key: "wed", label: "수요일" },
  { key: "thu", label: "목요일" },
  { key: "fri", label: "금요일" },
  { key: "sat", label: "토요일" },
  { key: "sun", label: "일요일" },
];

const DAY_LABELS: Record<string, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일"
};

export default function JComputerTimetablePage() {
  const { user, selectedCenter } = useAuth();
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithTeacher | null>(null);
  
  // Main tab state
  const [mainTab, setMainTab] = useState<"timetable" | "attendance-sheet">("timetable");
  
  // Teacher class view tab: "my" for own classes, "assistant" for assistant classes
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  
  // Attendance sheet states
  const printRef = useRef<HTMLDivElement>(null);
  const [sheetDay, setSheetDay] = useState("all");
  const [sheetClassroom, setSheetClassroom] = useState("all");
  const [sheetTeacher, setSheetTeacher] = useState("all");

  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;
  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const isAdminOrPrincipal = user && user.role >= UserRole.PRINCIPAL;
  const isStudent = user && user.role === UserRole.STUDENT;

  const { data: classes, isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  // Fetch teachers for everyone (for displaying teacher names in timetable)
  const { data: teachers } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/teachers`],
    enabled: !!selectedCenter?.id,
  });

  // Fetch enrollments for attendance sheet
  const { data: enrollments } = useQuery<Enrollment[]>({
    queryKey: ["/api/enrollments", selectedCenter?.id],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments?centerId=${selectedCenter?.id}`);
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

  // Fetch all students for attendance sheet
  const { data: students } = useQuery<User[]>({
    queryKey: ["/api/users", "students", selectedCenter?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users?centerId=${selectedCenter?.id}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      const users = await res.json();
      return users.filter((u: User) => u.role === 1); // role 1 = student
    },
    enabled: !!selectedCenter?.id,
  });

  const teacherMap = useMemo(() => 
    new Map(teachers?.map((t) => [t.id, t]) ?? []), 
    [teachers]
  );
  const studentMap = useMemo(() => 
    new Map(students?.map((s) => [s.id, s]) ?? []), 
    [students]
  );

  // For teachers, show only their classes; for admin/principal/students, show selected teacher's classes
  // "all" means show all classes
  const showAllTeachers = isAdminOrPrincipal && selectedTeacher === "all";
  const effectiveTeacher = isTeacherOnly ? user?.id : selectedTeacher;

  const targetTeacherId = isTeacherOnly ? user?.id : effectiveTeacher;

  const ownClassesForTarget = useMemo(() => 
    targetTeacherId ? classes?.filter(cls => cls.teacherId === targetTeacherId) ?? [] : [],
    [classes, targetTeacherId]
  );
  const assistantClassesForTarget = useMemo(() => 
    targetTeacherId ? classes?.filter(cls => isAssistantTeacher(cls, targetTeacherId) && cls.teacherId !== targetTeacherId) ?? [] : [],
    [classes, targetTeacherId]
  );
  const hasAssistantClasses = !showAllTeachers && targetTeacherId && targetTeacherId !== "all" && assistantClassesForTarget.length > 0;

  const filteredClasses = classes?.filter((cls) => {
    if (isTeacherOnly) {
      if (teacherViewTab === "my") return cls.teacherId === user?.id;
      if (teacherViewTab === "assistant") return isAssistantTeacher(cls, user?.id) && cls.teacherId !== user?.id;
      return cls.teacherId === user?.id || isAssistantTeacher(cls, user?.id);
    }
    if (showAllTeachers) return true;
    if (!effectiveTeacher || effectiveTeacher === "all") return true;
    if (teacherViewTab === "my") return cls.teacherId === effectiveTeacher;
    if (teacherViewTab === "assistant") return isAssistantTeacher(cls, effectiveTeacher) && cls.teacherId !== effectiveTeacher;
    return cls.teacherId === effectiveTeacher || isAssistantTeacher(cls, effectiveTeacher);
  }) ?? [];

  const handleClassClick = (cls: Class) => {
    const classWithTeacher: ClassWithTeacher = {
      ...cls,
      teacher: cls.teacherId ? teacherMap.get(cls.teacherId) : undefined,
    };
    setSelectedClass(classWithTeacher);
  };

  // Set default teacher when teachers load
  // For Admin/Principal, default to "all" (show all teachers)
  // For others, default to first teacher
  if (!isTeacherOnly && teachers && teachers.length > 0 && !selectedTeacher) {
    if (isAdminOrPrincipal) {
      setSelectedTeacher("all");
    } else {
      setSelectedTeacher(teachers[0].id);
    }
  }

  // === Attendance Sheet Helper Functions ===
  const uniqueClassrooms = Array.from(new Set(
    classes?.map((c) => c.classroom).filter(Boolean) as string[]
  )).sort();

  const sheetFilteredClasses = classes?.filter((cls) => {
    // Day filter - check if class runs on selected day
    if (sheetDay !== "all") {
      const classDays = Array.isArray(cls.days) ? cls.days : [];
      if (!classDays.includes(sheetDay)) return false;
    }
    // Classroom filter
    if (sheetClassroom !== "all" && cls.classroom !== sheetClassroom) return false;
    // Teacher filter
    if (sheetTeacher !== "all" && cls.teacherId !== sheetTeacher) return false;
    return true;
  }).sort((a, b) => {
    // Sort by earliest start time
    const timeA = a.startTime || "99:99";
    const timeB = b.startTime || "99:99";
    return timeA.localeCompare(timeB);
  }) ?? [];

  const getEnrolledStudents = useCallback((classId: string) => {
    const classEnrollments = enrollments?.filter((e) => e.classId === classId) ?? [];
    return classEnrollments
      .map((e) => studentMap.get(e.studentId))
      .filter(Boolean) as User[];
  }, [enrollments, studentMap]);

  const getScheduleDisplay = (cls: Class) => {
    const days = cls.days.map((d) => DAY_LABELS[d] || d).join(", ");
    if (cls.schedule) {
      try {
        const scheduleArray = JSON.parse(cls.schedule);
        const times = scheduleArray.map((s: any) => `${DAY_LABELS[s.day] || s.day} ${s.startTime}-${s.endTime}`).join(" / ");
        return times;
      } catch {}
    }
    return `${days} ${cls.startTime}-${cls.endTime}`;
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>출석부</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Noto Sans KR', sans-serif; font-size: 12px; margin: 0; padding: 0; }
            .attendance-sheet { 
              page-break-inside: avoid;
              break-inside: avoid;
              margin-bottom: 20px;
              padding-bottom: 10px;
            }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .class-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; flex-wrap: wrap; gap: 5px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333; padding: 6px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .student-name { text-align: left; padding-left: 10px; }
            .attendance-box { width: 30px; height: 30px; }
            .no-print { display: none !important; }
            /* Ensure continuous printing - remove any automatic page breaks between classes */
            .space-y-8 > * + * { margin-top: 20px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExcelDownload = () => {
    if (sheetFilteredClasses.length === 0) return;

    let csvContent = "\uFEFF";
    
    sheetFilteredClasses.forEach((cls) => {
      const enrolledStudents = getEnrolledStudents(cls.id);
      const teacherName = cls.teacherId ? teacherMap.get(cls.teacherId)?.name || "" : "";
      
      csvContent += `"${cls.name} ${cls.subject}반"\n`;
      csvContent += `"선생님: ${teacherName}","교실: ${cls.classroom || '-'}","시간: ${getScheduleDisplay(cls)}"\n`;
      csvContent += `"번호","이름","학년","월","화","수","목","금","토","일","비고"\n`;
      
      enrolledStudents.forEach((student, idx) => {
        csvContent += `"${idx + 1}","${student.name}","${student.grade || ''}","","","","","","","",""\n`;
      });
      
      csvContent += "\n\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `출석부_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">제이컴퓨터 시간표</h1>
            <p className="text-muted-foreground">
              {selectedCenter?.name} {isTeacherOrAbove ? "수업 관리" : "수업 신청"}
            </p>
          </div>
          <ManualButton menuKey="timetable" />
        </div>
        {isTeacherOrAbove && mainTab === "timetable" && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-class">
                <Plus className="h-4 w-4 mr-2" />
                수업 생성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>새 수업 생성</DialogTitle>
                <DialogDescription>수업 정보를 입력해주세요</DialogDescription>
              </DialogHeader>
              <CreateClassDialog
                teachers={teachers ?? []}
                onClose={() => setIsCreateOpen(false)}
                existingClasses={classes ?? []}
              />
            </DialogContent>
          </Dialog>
        )}
        {isTeacherOrAbove && mainTab === "attendance-sheet" && (
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} disabled={sheetFilteredClasses.length === 0} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              인쇄
            </Button>
            <Button variant="outline" onClick={handleExcelDownload} disabled={sheetFilteredClasses.length === 0} data-testid="button-excel-download">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      {isTeacherOrAbove && (
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "timetable" | "attendance-sheet")}>
          <TabsList>
            <TabsTrigger value="timetable" data-testid="tab-timetable">
              <Users className="h-4 w-4 mr-2" />
              시간표
            </TabsTrigger>
            <TabsTrigger value="attendance-sheet" data-testid="tab-attendance-sheet">
              <Printer className="h-4 w-4 mr-2" />
              출석부 출력
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Timetable Tab Content */}
      {mainTab === "timetable" && (
        <>
          {!isTeacherOnly && teachers && teachers.length > 0 && (
            <Tabs value={selectedTeacher || "all"} onValueChange={(v) => { setSelectedTeacher(v); setTeacherViewTab("my"); }}>
              <TabsList className="flex-wrap h-auto gap-1">
            {isAdminOrPrincipal && (
              <TabsTrigger value="all" data-testid="tab-teacher-all">
                전체
              </TabsTrigger>
            )}
            {teachers.map((t) => (
              <TabsTrigger key={t.id} value={t.id} data-testid={`tab-teacher-${t.id}`}>
                {t.name} 선생님
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <TeacherClassTabs
        teacherViewTab={teacherViewTab}
        onTabChange={setTeacherViewTab}
        ownCount={ownClassesForTarget.length}
        assistantCount={assistantClassesForTarget.length}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {teacherViewTab === "assistant" && hasAssistantClasses ? (
              <>
                부담임 수업 시간표
                <Badge variant="outline" className="border-orange-400 text-orange-600 dark:text-orange-400 text-xs">부담임</Badge>
              </>
            ) : "시간표"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingClasses ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : showAllTeachers ? (
            <AllTeachersTimetableGrid
              classes={filteredClasses}
              onClassClick={handleClassClick}
              teacherMap={teacherMap}
              allClasses={classes ?? []}
            />
          ) : teacherViewTab === "assistant" && hasAssistantClasses ? (
            <AllTeachersTimetableGrid
              classes={filteredClasses}
              onClassClick={handleClassClick}
              teacherMap={teacherMap}
              hideTimeColumn
              allClasses={classes ?? []}
            />
          ) : (
            <TimetableGrid
              classes={filteredClasses}
              onClassClick={handleClassClick}
              isStudent={!isTeacherOrAbove}
              teacherMap={teacherMap}
              allClasses={classes ?? []}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isTeacherOrAbove ? "수업 관리" : "수업 신청"}</DialogTitle>
            <DialogDescription>
              {isTeacherOrAbove ? "수업을 수정하거나 삭제할 수 있습니다" : "이 수업에 신청하시겠습니까?"}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            isTeacherOrAbove ? (
              <EditClassDialog
                classItem={selectedClass}
                teachers={teachers ?? []}
                onClose={() => setSelectedClass(null)}
                existingClasses={classes ?? []}
              />
            ) : (
              <EnrollDialog
                classItem={selectedClass}
                onClose={() => setSelectedClass(null)}
              />
            )
          )}
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Attendance Sheet Tab Content */}
      {mainTab === "attendance-sheet" && isTeacherOrAbove && (
        <>
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                필터
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Day filter */}
                <div className="space-y-2">
                  <Label>요일</Label>
                  <Select value={sheetDay} onValueChange={setSheetDay}>
                    <SelectTrigger data-testid="select-day-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_DAYS.map((day) => (
                        <SelectItem key={day.key} value={day.key}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Classroom filter */}
                <div className="space-y-2">
                  <Label>교실</Label>
                  <Select value={sheetClassroom} onValueChange={setSheetClassroom}>
                    <SelectTrigger data-testid="select-classroom-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {uniqueClassrooms.map((room) => (
                        <SelectItem key={room} value={room}>
                          {room}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Teacher filter */}
                <div className="space-y-2">
                  <Label>선생님</Label>
                  <Select value={sheetTeacher} onValueChange={setSheetTeacher}>
                    <SelectTrigger data-testid="select-teacher-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {teachers?.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} 선생님
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">미리보기 ({sheetFilteredClasses.length}개 수업)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClasses ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : sheetFilteredClasses.length === 0 ? (
                <div className="text-center text-muted-foreground py-8" data-testid="text-no-classes">
                  선택한 조건에 맞는 수업이 없습니다.
                </div>
              ) : (
                <div ref={printRef} className="space-y-8">
                  {sheetFilteredClasses.map((cls) => {
                    const enrolledStudents = getEnrolledStudents(cls.id);
                    const teacherName = cls.teacherId ? teacherMap.get(cls.teacherId)?.name || "" : "";
                    
                    return (
                      <div key={cls.id} className="attendance-sheet border rounded-lg p-4" data-testid={`card-class-${cls.id}`}>
                        {/* Header */}
                        <div className="header text-center mb-4 pb-3 border-b-2 border-foreground">
                          <h2 className="text-xl font-bold">{cls.name} {cls.subject}반 출석부</h2>
                        </div>
                        
                        {/* Class Info */}
                        <div className="class-info flex flex-wrap justify-between text-sm mb-4 gap-2">
                          <span><strong>선생님:</strong> {teacherName || "-"}</span>
                          <span><strong>교실:</strong> {cls.classroom || "-"}</span>
                          <span><strong>시간:</strong> {getScheduleDisplay(cls)}</span>
                          <span><strong>인원:</strong> {enrolledStudents.length}명</span>
                        </div>
                        
                        {/* Attendance Table */}
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-muted">
                              <th className="border p-2 w-12">번호</th>
                              <th className="border p-2 w-24">이름</th>
                              <th className="border p-2 w-16">학년</th>
                              <th className="border p-2 w-10">월</th>
                              <th className="border p-2 w-10">화</th>
                              <th className="border p-2 w-10">수</th>
                              <th className="border p-2 w-10">목</th>
                              <th className="border p-2 w-10">금</th>
                              <th className="border p-2 w-10">토</th>
                              <th className="border p-2 w-10">일</th>
                              <th className="border p-2">비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrolledStudents.length === 0 ? (
                              <tr>
                                <td colSpan={11} className="border p-4 text-center text-muted-foreground">
                                  등록된 학생이 없습니다.
                                </td>
                              </tr>
                            ) : (
                              enrolledStudents.map((student, idx) => (
                                <tr key={student.id}>
                                  <td className="border p-2 text-center">{idx + 1}</td>
                                  <td className="border p-2 text-left pl-3">{student.name}</td>
                                  <td className="border p-2 text-center">{student.grade || "-"}</td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"><div className="attendance-box h-6"></div></td>
                                  <td className="border p-2"></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
