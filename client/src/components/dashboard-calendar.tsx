import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { type AcademyCalendarEvent } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "wouter";

const EVENT_TYPES = [
  { value: "single", label: "단일 날짜" },
  { value: "period", label: "기간" },
  { value: "exam", label: "시험" },
];

export function DashboardCalendar() {
  const { selectedCenter } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const { data: events = [] } = useQuery<AcademyCalendarEvent[]>({
    queryKey: ["/api/academy-calendar-events", selectedCenter?.id, currentYear, currentMonth],
    queryFn: async () => {
      if (!selectedCenter?.id) return [];
      const res = await fetch(`/api/academy-calendar-events?centerId=${selectedCenter.id}&year=${currentYear}&month=${currentMonth}`);
      return res.json();
    },
    enabled: !!selectedCenter?.id,
  });

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

  const getEventPositionInfo = (event: AcademyCalendarEvent, date: Date) => {
    if (event.eventType === "single" || !event.endDate) {
      return { isStart: true, isEnd: true, isWeekStart: false, isWeekEnd: false };
    }
    const eventStart = parseISO(event.startDate);
    const eventEnd = parseISO(event.endDate);
    const isStart = isSameDay(date, eventStart);
    const isEnd = isSameDay(date, eventEnd);
    const dayOfWeek = date.getDay();
    const isWeekStart = dayOfWeek === 0 && !isStart;
    const isWeekEnd = dayOfWeek === 6 && !isEnd;
    return { isStart, isEnd, isWeekStart, isWeekEnd };
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
        getEventsForDate(day).forEach(e => allWeekEvents.add(e.id));
      }
      const weekEventsArr = events.filter(e => allWeekEvents.has(e.id));
      weekEventsArr.sort((a, b) => {
        const aDur = a.endDate ? (parseISO(a.endDate).getTime() - parseISO(a.startDate).getTime()) : 0;
        const bDur = b.endDate ? (parseISO(b.endDate).getTime() - parseISO(b.startDate).getTime()) : 0;
        if (bDur !== aDur) return bDur - aDur;
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
    return Math.max(40, 28 + weekMax * 18);
  };
  const eventsForSelectedDate = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} data-testid="dashboard-cal-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(currentDate, "yyyy년 M월", { locale: ko })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} data-testid="dashboard-cal-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Link href="/academy-calendar">
                <Badge variant="outline" className="cursor-pointer text-xs">
                  전체 보기
                </Badge>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-3">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
              <div
                key={day}
                className={cn(
                  "h-7 flex items-center justify-center font-medium text-[11px] bg-muted",
                  i === 0 && "text-red-500",
                  i === 6 && "text-blue-500"
                )}
              >
                {day}
              </div>
            ))}

            {calendarDays.map((day, dayIndex) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = day.getDay();

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-card p-0.5 cursor-pointer transition-colors hover:bg-accent/50",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground"
                  )}
                  style={{ minHeight: `${getCellMinHeight(dayIndex)}px` }}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDate(day);
                      setIsDetailOpen(true);
                    }
                  }}
                  data-testid={`dash-cal-${format(day, "yyyy-MM-dd")}`}
                >
                  <div className={cn(
                    "text-[11px] font-medium mb-0.5 w-5 h-5 flex items-center justify-center rounded-full mx-auto",
                    isToday && "bg-primary text-primary-foreground",
                    dayOfWeek === 0 && !isToday && "text-red-500",
                    dayOfWeek === 6 && !isToday && "text-blue-500"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="relative" style={{ minHeight: `${dayEvents.length > 0 ? (Math.max(...dayEvents.map(e => (eventSlotMap[format(day, "yyyy-MM-dd")]?.[e.id] ?? 0))) + 1) * 18 : 0}px` }}>
                    {dayEvents.map((event) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const slot = eventSlotMap[dateKey]?.[event.id] ?? 0;
                      const { isStart, isEnd, isWeekStart, isWeekEnd } = getEventPositionInfo(event, day);
                      const showLeftRound = isStart || isWeekStart;
                      const showRightRound = isEnd || isWeekEnd;

                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "absolute left-0 right-0 text-[9px] md:text-[10px] text-white truncate px-0.5 leading-[16px] h-[16px]",
                            showLeftRound && showRightRound && "rounded",
                            showLeftRound && !showRightRound && "rounded-l",
                            showRightRound && !showLeftRound && "rounded-r",
                            !showLeftRound && !showRightRound && "rounded-none"
                          )}
                          style={{
                            top: `${slot * 18}px`,
                            backgroundColor: event.color,
                            marginLeft: showLeftRound ? "0" : "-2px",
                            marginRight: showRightRound ? "0" : "-2px",
                            paddingLeft: showLeftRound ? "3px" : "1px",
                            paddingRight: showRightRound ? "3px" : "1px",
                          }}
                          title={event.title}
                        >
                          {(isStart || isWeekStart) && (
                            <span className="flex items-center gap-0.5">
                              {event.eventType === "exam" && <BookOpen className="h-2.5 w-2.5 flex-shrink-0" />}
                              <span className="truncate">{isStart ? event.title : `← ${event.title}`}</span>
                            </span>
                          )}
                          {!isStart && !isWeekStart && <span>&nbsp;</span>}
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

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
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
              eventsForSelectedDate.map(event => (
                <Card key={event.id} className="relative">
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                    style={{ backgroundColor: event.color }}
                  />
                  <CardContent className="p-3 pl-4">
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
                        : event.startDate}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
