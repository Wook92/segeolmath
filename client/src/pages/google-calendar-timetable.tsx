import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Link2, Link2Off, Users, Plus, X, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type User } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

interface Feature {
  id: string;
  name: string;
  menuKey: string;
  featureType: string;
}

interface CenterFeature {
  id: string;
  centerId: string;
  featureId: string;
  isHidden: boolean;
}

interface CalendarEvent {
  id: string;
  recurringEventId?: string | null;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
}

interface StudentInfo {
  id: string;
  name: string;
  grade: string;
}

interface EventColor {
  id: string;
  centerId: string;
  eventId: string;
  colorIndex: number;
}

interface EventTeacher {
  id: string;
  centerId: string;
  eventId: string;
  teacherId: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8AM to 10PM

const EVENT_COLORS = [
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-800 dark:text-sky-200", hover: "hover:bg-sky-200 dark:hover:bg-sky-900/50" },
  { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-200", hover: "hover:bg-blue-200 dark:hover:bg-blue-900/50" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-800 dark:text-cyan-200", hover: "hover:bg-cyan-200 dark:hover:bg-cyan-900/50" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-800 dark:text-teal-200", hover: "hover:bg-teal-200 dark:hover:bg-teal-900/50" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-800 dark:text-indigo-200", hover: "hover:bg-indigo-200 dark:hover:bg-indigo-900/50" },
  { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-200", hover: "hover:bg-green-200 dark:hover:bg-green-900/50" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-800 dark:text-lime-200", hover: "hover:bg-lime-200 dark:hover:bg-lime-900/50" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-200", hover: "hover:bg-amber-200 dark:hover:bg-amber-900/50" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-200", hover: "hover:bg-orange-200 dark:hover:bg-orange-900/50" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-200", hover: "hover:bg-purple-200 dark:hover:bg-purple-900/50" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-800 dark:text-pink-200", hover: "hover:bg-pink-200 dark:hover:bg-pink-900/50" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-800 dark:text-rose-200", hover: "hover:bg-rose-200 dark:hover:bg-rose-900/50" },
];

const getEventColorByIndex = (index: number) => {
  return EVENT_COLORS[index % EVENT_COLORS.length];
};

const getEventColorByTitle = (eventTitle: string) => {
  let hash = 0;
  for (let i = 0; i < eventTitle.length; i++) {
    hash = eventTitle.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EVENT_COLORS.length;
  return EVENT_COLORS[index];
};

export default function GoogleCalendarTimetable() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isConnectGuideOpen, setIsConnectGuideOpen] = useState(false);

  const centerId = selectedCenter?.id;
  const isStudent = user?.role === UserRole.STUDENT;
  const isAdmin = user?.role === UserRole.ADMIN;
  const canManage = user && (user.role === UserRole.ADMIN || user.role === UserRole.PRINCIPAL);
  const canEditStudents = user && (user.role === UserRole.ADMIN || user.role === UserRole.PRINCIPAL || user.role === UserRole.TEACHER);

  // Check if this feature is enabled for the current center
  const { data: features = [] } = useQuery<Feature[]>({
    queryKey: ["/api/features"],
    enabled: !!user,
  });

  const { data: centerFeatures = [] } = useQuery<CenterFeature[]>({
    queryKey: ["/api/center-features", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const res = await fetch(`/api/center-features/${centerId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!centerId && !!user,
  });

  // Check if Google Calendar Timetable feature is enabled for this center
  const isFeatureEnabled = useMemo(() => {
    // Admin can always access all features for management
    if (isAdmin) return true;
    
    const gcalFeature = features.find(f => f.menuKey === "google-calendar-timetable");
    if (!gcalFeature) return false;
    
    // Check if center has subscribed to this feature
    const enabledFeatureIds = centerFeatures
      .filter(cf => !cf.isHidden)
      .map(cf => cf.featureId);
    
    return enabledFeatureIds.includes(gcalFeature.id);
  }, [features, centerFeatures, isAdmin]);

  const { data: connectionStatus, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/google-calendar/status", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/status?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    enabled: !!centerId,
  });

  const { data: events, isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/google-calendar/events", centerId, currentWeekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events?centerId=${centerId}&weekStart=${currentWeekStart.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    enabled: !!centerId && connectionStatus?.connected && !isStudent,
  });

  const { data: myEvents, isLoading: myEventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/google-calendar/my-events", centerId, user?.id, currentWeekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/my-events?centerId=${centerId}&studentId=${user?.id}&weekStart=${currentWeekStart.toISOString()}`);
      if (!res.ok) throw new Error("Failed to fetch my events");
      return res.json();
    },
    enabled: !!centerId && connectionStatus?.connected && isStudent,
  });

  // For recurring events, use recurringEventId to fetch students
  const eventIdForStudents = selectedEvent?.recurringEventId || selectedEvent?.id;
  
  const { data: eventStudents, isLoading: studentsLoading } = useQuery<StudentInfo[]>({
    queryKey: ["/api/google-calendar/events", eventIdForStudents, "students", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events/${eventIdForStudents}/students?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!eventIdForStudents && !!centerId,
  });

  const { data: allStudents } = useQuery<User[]>({
    queryKey: ["/api/users", { role: UserRole.STUDENT, centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/users?role=${UserRole.STUDENT}&centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!centerId && isStudentDialogOpen,
  });

  const { data: eventColors } = useQuery<EventColor[]>({
    queryKey: ["/api/google-calendar/event-colors", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/event-colors?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch event colors");
      return res.json();
    },
    enabled: !!centerId,
  });

  // Get all teachers for the center
  const { data: allTeachers } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "teachers", centerId }],
    queryFn: async () => {
      const res = await fetch(`/api/users?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const users: User[] = await res.json();
      return users.filter(u => 
        u.role === UserRole.TEACHER || 
        u.role === UserRole.PRINCIPAL || 
        u.role === UserRole.ADMIN ||
        u.role === UserRole.CLINIC_TEACHER
      );
    },
    enabled: !!centerId,
  });

  // Get event teacher assignments
  const { data: eventTeachers } = useQuery<EventTeacher[]>({
    queryKey: ["/api/google-calendar/event-teachers", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/event-teachers?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch event teachers");
      return res.json();
    },
    enabled: !!centerId,
  });

  // Map eventId -> teacherId
  const eventTeacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    eventTeachers?.forEach(et => {
      map[et.eventId] = et.teacherId;
    });
    return map;
  }, [eventTeachers]);

  // Map teacherId -> colorIndex (consistent color per teacher)
  const teacherColorMap = useMemo(() => {
    const map: Record<string, number> = {};
    allTeachers?.forEach((teacher, index) => {
      map[teacher.id] = index % EVENT_COLORS.length;
    });
    return map;
  }, [allTeachers]);

  const eventColorMap = useMemo(() => {
    const map: Record<string, number> = {};
    eventColors?.forEach(ec => {
      map[ec.eventId] = ec.colorIndex;
    });
    return map;
  }, [eventColors]);

  const getEventColor = (event: CalendarEvent) => {
    // First check manual color override
    const colorIndex = eventColorMap[event.id];
    if (colorIndex !== undefined) {
      return getEventColorByIndex(colorIndex);
    }
    // Then check teacher assignment for auto-color
    const eventId = event.recurringEventId || event.id;
    const teacherId = eventTeacherMap[eventId];
    if (teacherId && teacherColorMap[teacherId] !== undefined) {
      return getEventColorByIndex(teacherColorMap[teacherId]);
    }
    // Fallback to title-based color
    return getEventColorByTitle(event.title);
  };

  // Get teacher name for an event
  const getEventTeacherName = (event: CalendarEvent) => {
    const eventId = event.recurringEventId || event.id;
    const teacherId = eventTeacherMap[eventId];
    if (teacherId) {
      const teacher = allTeachers?.find(t => t.id === teacherId);
      return teacher?.name;
    }
    return null;
  };

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/google-calendar/auth-url?centerId=${centerId}&actorId=${user?.id}`);
      if (!response.ok) throw new Error("Failed to get auth URL");
      const data = await response.json();
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({ title: "연동 시작에 실패했습니다", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/google-calendar/disconnect?centerId=${centerId}&actorId=${user?.id}`);
    },
    onSuccess: async () => {
      await invalidateQueriesStartingWith("/api/google-calendar");
      toast({ title: "구글 캘린더 연동이 해제되었습니다" });
    },
    onError: () => {
      toast({ title: "연동 해제에 실패했습니다", variant: "destructive" });
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async ({ eventId, studentId }: { eventId: string; studentId: string }) => {
      return apiRequest("POST", `/api/google-calendar/events/${eventId}/students?actorId=${user?.id}`, {
        centerId,
        studentId,
      });
    },
    onSuccess: async () => {
      const eventIdToInvalidate = selectedEvent?.recurringEventId || selectedEvent?.id;
      await queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events", eventIdToInvalidate, "students", centerId] });
      setSelectedStudentId("");
      toast({ title: "학생이 추가되었습니다" });
    },
    onError: () => {
      toast({ title: "학생 추가에 실패했습니다", variant: "destructive" });
    },
  });

  const setColorMutation = useMutation({
    mutationFn: async ({ eventId, colorIndex }: { eventId: string; colorIndex: number }) => {
      return apiRequest("POST", `/api/google-calendar/events/${eventId}/color?actorId=${user?.id}`, {
        centerId,
        colorIndex,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/event-colors", centerId] });
      toast({ title: "색깔이 변경되었습니다" });
    },
    onError: () => {
      toast({ title: "색깔 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async ({ eventId, studentId }: { eventId: string; studentId: string }) => {
      return apiRequest("DELETE", `/api/google-calendar/events/${eventId}/students/${studentId}?actorId=${user?.id}&centerId=${centerId}`);
    },
    onSuccess: async () => {
      const eventIdToInvalidate = selectedEvent?.recurringEventId || selectedEvent?.id;
      await queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/events", eventIdToInvalidate, "students", centerId] });
      toast({ title: "학생이 제거되었습니다" });
    },
    onError: () => {
      toast({ title: "학생 제거에 실패했습니다", variant: "destructive" });
    },
  });

  const setTeacherMutation = useMutation({
    mutationFn: async ({ eventId, teacherId }: { eventId: string; teacherId: string | null }) => {
      return apiRequest("POST", `/api/google-calendar/events/${eventId}/teacher?actorId=${user?.id}`, {
        centerId,
        teacherId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/event-teachers", centerId] });
      toast({ title: "담당 선생님이 설정되었습니다" });
    },
    onError: () => {
      toast({ title: "담당 선생님 설정에 실패했습니다", variant: "destructive" });
    },
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const displayEvents = isStudent ? myEvents : events;

  // Extended event type with time info and rowspan for rendering
  type EventWithSpan = CalendarEvent & {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    rowSpan: number;
  };

  // Map of events by day and starting hour (only starting hour, with rowspan info)
  const eventsByDayAndHour = useMemo(() => {
    if (!displayEvents) return {};
    
    const map: Record<string, Record<number, EventWithSpan[]>> = {};
    
    for (const event of displayEvents) {
      if (!event.start || !event.end) continue;
      
      const startDate = parseISO(event.start);
      const endDate = parseISO(event.end);
      const dayKey = format(startDate, "yyyy-MM-dd");
      
      const startHour = startDate.getHours();
      const startMinute = startDate.getMinutes();
      const endHour = endDate.getHours();
      const endMinute = endDate.getMinutes();
      
      // Calculate how many hour slots this event spans
      const lastHour = endMinute > 0 ? endHour : endHour - 1;
      const rowSpan = Math.max(1, lastHour - startHour + 1);
      
      if (!map[dayKey]) map[dayKey] = {};
      if (!map[dayKey][startHour]) map[dayKey][startHour] = [];
      
      map[dayKey][startHour].push({
        ...event,
        startHour,
        startMinute,
        endHour,
        endMinute,
        rowSpan,
      });
    }
    
    return map;
  }, [displayEvents]);

  // Track which cells should be skipped due to rowspan
  const skippedCells = useMemo(() => {
    const skipped: Record<string, Set<number>> = {};
    
    for (const dayKey in eventsByDayAndHour) {
      skipped[dayKey] = new Set<number>();
      for (const hourStr in eventsByDayAndHour[dayKey]) {
        const hour = parseInt(hourStr);
        const events = eventsByDayAndHour[dayKey][hour];
        for (const event of events) {
          // Mark hours that should be skipped (after the start hour)
          for (let h = hour + 1; h < hour + event.rowSpan; h++) {
            skipped[dayKey].add(h);
          }
        }
      }
    }
    
    return skipped;
  }, [eventsByDayAndHour]);

  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleThisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const openEventDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsStudentDialogOpen(true);
  };

  const handleAddStudent = () => {
    if (!selectedEvent || !selectedStudentId) return;
    // For recurring events, use recurringEventId so student can see all instances
    const eventIdToUse = selectedEvent.recurringEventId || selectedEvent.id;
    addStudentMutation.mutate({ eventId: eventIdToUse, studentId: selectedStudentId });
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!selectedEvent) return;
    // For recurring events, use recurringEventId
    const eventIdToUse = selectedEvent.recurringEventId || selectedEvent.id;
    removeStudentMutation.mutate({ eventId: eventIdToUse, studentId });
  };

  const availableStudents = allStudents?.filter(
    s => !eventStudents?.some(es => es.id === s.id)
  ) || [];

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4" data-testid="gcal-login-required">
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">로그인이 필요합니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this feature is enabled for the current center
  if (!isFeatureEnabled) {
    return (
      <div className="container mx-auto py-8 px-4" data-testid="gcal-feature-disabled">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle>접근 권한이 없습니다</CardTitle>
            </div>
            <CardDescription>
              구글 캘린더 연동 기능은 별도 신청이 필요한 추가 기능입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              이 기능을 사용하려면 원장님께서 기능 관리 메뉴에서 "시간표 (구글캘린더 연동)" 기능을 신청해주셔야 합니다.
            </p>
            <Button onClick={() => setLocation("/timetable")} data-testid="button-go-timetable">
              일반 시간표로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6" data-testid="gcal-timetable-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isStudent ? "나의 시간표" : "시간표 (구글캘린더 연동)"}
          </h1>
          <p className="text-muted-foreground">
            {isStudent ? "선생님이 등록한 나의 수업 일정입니다" : "구글 캘린더에서 가져온 일주일 시간표"}
          </p>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-2">
            {connectionStatus?.connected ? (
              <Button 
                variant="outline" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                <Link2Off className="h-4 w-4 mr-2" />
                연동 해제
              </Button>
            ) : (
              <Button 
                onClick={() => setIsConnectGuideOpen(true)}
                data-testid="button-connect"
              >
                <Link2 className="h-4 w-4 mr-2" />
                구글 캘린더 연결
              </Button>
            )}
          </div>
        )}
      </div>

      {statusLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !connectionStatus?.connected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-60 gap-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">구글 캘린더가 연동되지 않았습니다</p>
              <p className="text-muted-foreground text-sm mt-1">
                {canManage 
                  ? "위의 '구글 캘린더 연결' 버튼을 클릭하여 연동하세요"
                  : "원장님께 구글 캘린더 연동을 요청하세요"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isStudent && myEvents?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-60 gap-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">등록된 수업이 없습니다</p>
              <p className="text-muted-foreground text-sm mt-1">
                선생님이 시간표에 학생을 등록하면 여기에 표시됩니다
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek} data-testid="button-prev-week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleThisWeek} data-testid="button-this-week">
                이번 주
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextWeek} data-testid="button-next-week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-lg font-medium">
              {format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} ~ {format(addDays(currentWeekStart, 6), "M월 d일", { locale: ko })}
            </div>
          </div>

          {(isStudent ? myEventsLoading : eventsLoading) ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted w-16 text-sm">시간</th>
                      {weekDays.map((day, i) => (
                        <th 
                          key={i} 
                          className={cn(
                            "border p-2 bg-muted text-sm",
                            isSameDay(day, new Date()) && "bg-primary/10"
                          )}
                        >
                          <div>{WEEKDAYS[day.getDay()]}</div>
                          <div className="text-xs text-muted-foreground">{format(day, "M/d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map(hour => (
                      <tr key={hour}>
                        <td className="border p-2 text-center text-sm text-muted-foreground">
                          {hour}:00
                        </td>
                        {weekDays.map((day, i) => {
                          const dayKey = format(day, "yyyy-MM-dd");
                          
                          // Skip cells that are covered by rowspan from previous rows
                          if (skippedCells[dayKey]?.has(hour)) {
                            return null;
                          }
                          
                          const cellEvents = eventsByDayAndHour[dayKey]?.[hour] || [];
                          // Find max rowspan for this cell
                          const maxRowSpan = cellEvents.length > 0 
                            ? Math.max(...cellEvents.map(e => e.rowSpan))
                            : 1;
                          
                          return (
                            <td 
                              key={i} 
                              rowSpan={maxRowSpan}
                              className={cn(
                                "border p-1 align-top",
                                isSameDay(day, new Date()) && "bg-primary/5"
                              )}
                              style={{ height: `${maxRowSpan * 48}px` }}
                            >
                              {cellEvents.map(event => {
                                const color = getEventColor(event);
                                const timeDisplay = `${String(event.startHour).padStart(2, '0')}:${String(event.startMinute).padStart(2, '0')}~${String(event.endHour).padStart(2, '0')}:${String(event.endMinute).padStart(2, '0')}`;
                                const teacherName = getEventTeacherName(event);
                                
                                return (
                                  <button
                                    key={event.id}
                                    onClick={() => !isStudent && openEventDialog(event)}
                                    className={cn(
                                      "w-full h-full text-left p-2 rounded text-xs transition-colors flex flex-col justify-start",
                                      color.bg,
                                      color.text,
                                      !isStudent && color.hover,
                                      isStudent && "cursor-default"
                                    )}
                                    data-testid={`event-${event.id}`}
                                  >
                                    <div className="font-medium">{event.title}</div>
                                    <div className="opacity-75 text-[10px]">{timeDisplay}</div>
                                    {teacherName && (
                                      <div className="opacity-75 text-[10px] mt-0.5">{teacherName}</div>
                                    )}
                                    {event.location && (
                                      <div className="opacity-75 truncate mt-1">{event.location}</div>
                                    )}
                                  </button>
                                );
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.start && format(parseISO(selectedEvent.start), "M월 d일 (E) HH:mm", { locale: ko })}
              {selectedEvent?.end && ` ~ ${format(parseISO(selectedEvent.end), "HH:mm")}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {canEditStudents && (
              <>
                <div>
                  <h4 className="font-medium mb-2">담당 선생님</h4>
                  <Select
                    value={selectedEvent ? (eventTeacherMap[selectedEvent.recurringEventId || selectedEvent.id] || "none") : "none"}
                    onValueChange={(value) => {
                      if (selectedEvent) {
                        const eventId = selectedEvent.recurringEventId || selectedEvent.id;
                        setTeacherMutation.mutate({ eventId, teacherId: value === "none" ? null : value });
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-teacher">
                      <SelectValue placeholder="선생님 선택 (미지정)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미지정</SelectItem>
                      {allTeachers?.map(teacher => {
                        const colorIndex = teacherColorMap[teacher.id];
                        const color = EVENT_COLORS[colorIndex];
                        return (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", color?.bg)} />
                              {teacher.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    선생님별로 자동으로 색상이 구분됩니다
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">색깔 선택 (수동)</h4>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_COLORS.map((colorOption, index) => {
                      const isSelected = selectedEvent && eventColorMap[selectedEvent.id] === index;
                      return (
                        <button
                          key={index}
                          onClick={() => selectedEvent && setColorMutation.mutate({ eventId: selectedEvent.id, colorIndex: index })}
                          className={cn(
                            "w-8 h-8 rounded-md border-2 transition-all",
                            colorOption.bg,
                            isSelected ? "border-primary ring-2 ring-primary/50" : "border-transparent hover:border-muted-foreground/50"
                          )}
                          disabled={setColorMutation.isPending}
                          data-testid={`color-option-${index}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <h4 className="font-medium mb-2">수강 학생</h4>
              {studentsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">불러오는 중...</span>
                </div>
              ) : eventStudents?.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 학생이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {eventStudents?.map(student => (
                    <Badge key={student.id} variant="secondary" className="gap-1">
                      {student.name}
                      {student.grade && <span className="text-muted-foreground">({student.grade})</span>}
                      {canEditStudents && (
                        <button
                          onClick={() => handleRemoveStudent(student.id)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-student-${student.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {canEditStudents && (
              <div className="space-y-2">
                <h4 className="font-medium">학생 추가</h4>
                <div className="flex gap-2">
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="flex-1" data-testid="select-student">
                      <SelectValue placeholder="학생 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-[200px]">
                        {availableStudents.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} {student.grade && `(${student.grade})`}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="icon" 
                    onClick={handleAddStudent}
                    disabled={!selectedStudentId || addStudentMutation.isPending}
                    data-testid="button-add-student"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsStudentDialogOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConnectGuideOpen} onOpenChange={setIsConnectGuideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>구글 캘린더 연동 안내</DialogTitle>
            <DialogDescription>
              연동 전 아래 안내사항을 확인해주세요
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                중요: 구글 아이디 등록 필요
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                구글 캘린더 연동을 위해서는 먼저 <strong>관리자에게 본인의 구글 아이디(이메일)를 전달</strong>해야 합니다.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                관리자가 등록을 완료했다고 안내를 받은 후 아래 버튼을 눌러 연동을 진행해주세요.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsConnectGuideOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={() => {
                setIsConnectGuideOpen(false);
                connectMutation.mutate();
              }}
              disabled={connectMutation.isPending}
              data-testid="button-confirm-connect"
            >
              {connectMutation.isPending ? "연결 중..." : "등록 완료, 연동 진행"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
