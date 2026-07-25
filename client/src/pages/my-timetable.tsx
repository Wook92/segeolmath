import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, User, Trash2, Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { isAssistantTeacher, type Class, type User as UserType, type Center } from "@shared/schema";
import { cn } from "@/lib/utils";

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

function generateTimeSlots30(classes: { startTime: string; schedule?: string | null }[]): string[] {
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
  const totalSlots = (END_HOUR - minHour) * 2;
  return Array.from({ length: totalSlots }, (_, i) => {
    const hour = Math.floor(i / 2) + minHour;
    const min = (i % 2) * 30;
    return `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
  });
}

interface EnrolledClass extends Class {
  teacher?: UserType;
  center?: Center;
  enrollmentId?: string;
}

function MyTimetableGrid({ classes, onClassClick, currentUserId }: { classes: EnrolledClass[]; onClassClick?: (cls: EnrolledClass) => void; currentUserId?: string }) {
  const TIME_SLOTS = useMemo(() => generateTimeSlots30(classes), [classes]);
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  const getClassesForSlot = (day: string, time: string) => {
    return classes.filter((cls) => {
      if (!cls.days.includes(day)) return false;
      const slotMin = timeToMinutes(time);
      const startMin = timeToMinutes(cls.startTime);
      const endMin = timeToMinutes(cls.endTime);
      return slotMin >= startMin && slotMin < endMin;
    });
  };

  const isClassStart = (cls: Class, time: string) => {
    return cls.startTime === time;
  };

  const getClassDuration = (cls: Class) => {
    const durationMin = timeToMinutes(cls.endTime) - timeToMinutes(cls.startTime);
    return Math.max(1, Math.ceil(durationMin / 30));
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
          const isHalfHour = time.endsWith(":30");
          return DAYS.map((day) => {
            const slotClasses = getClassesForSlot(day.key, time);
            const startingClasses = slotClasses.filter((c) => isClassStart(c, time));
            return (
              <div
                key={`${day.key}-${time}`}
                className={cn(
                  "h-6 md:h-8 border-x border-border/30 md:border-border/50 relative",
                  isHalfHour ? "border-b border-t-0" : "border-t"
                )}
              >
                {startingClasses.map((cls) => {
                  const duration = getClassDuration(cls);
                  return (
                    <button
                      key={cls.id}
                      onClick={() => onClassClick?.(cls)}
                      className="absolute inset-x-0 top-0 rounded-sm md:rounded-md p-0.5 md:p-1 text-left text-[8px] md:text-xs font-medium overflow-hidden cursor-pointer transition-all hover:brightness-95 active:brightness-90"
                      style={{
                        backgroundColor: cls.color,
                        height: `calc(${duration * 100}% + ${(duration - 1) * 1}px)`,
                        zIndex: 10,
                        color: "#1a1a1a",
                      }}
                      data-testid={`my-class-slot-${cls.id}`}
                    >
                      <p className="truncate leading-tight">{cls.name}</p>
                      <p className="text-[7px] md:text-[10px] opacity-80 truncate">{cls.subject}반</p>
                      {isAssistantTeacher(cls, currentUserId) && cls.teacherId !== currentUserId && (
                        <p className="text-[7px] md:text-[9px] opacity-90 truncate bg-black/10 rounded px-0.5 inline-block">부담임</p>
                      )}
                      <p className="text-[7px] md:text-[10px] opacity-80 hidden md:block">
                        {cls.startTime}-{cls.endTime}
                      </p>
                      {cls.teacher && (
                        <p className="text-[7px] md:text-[10px] opacity-80 truncate hidden md:block">
                          {cls.teacher.name}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

export default function MyTimetablePage() {
  const { user, effectiveUser } = useAuth();
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState<EnrolledClass | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 학부모 계정인 경우 선택된 자녀의 시간표, 아니면 본인의 시간표
  const targetUserId = effectiveUser?.id || user?.id;

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/students/${targetUserId}/enrollments`],
    enabled: !!targetUserId,
  });

  const enrolledClasses: EnrolledClass[] = enrollments
    ?.filter((e) => e.class !== null)
    .map((e) => ({
      ...e.class,
      teacher: e.teacher,
      center: e.center,
      enrollmentId: e.id,
    })) || [];

  const deleteMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      return apiRequest("DELETE", `/api/enrollments/${enrollmentId}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/students");
      toast({ title: "수업이 삭제되었습니다" });
      setSelectedClass(null);
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "수업 삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (selectedClass?.enrollmentId) {
      deleteMutation.mutate(selectedClass.enrollmentId);
    }
  };

  const isLoading = enrollmentsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">나의 시간표</h1>
        <p className="text-muted-foreground">신청한 수업 일정을 확인하세요</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            시간표
          </CardTitle>
          <CardDescription>
            {enrolledClasses.length}개 수업 신청됨
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : enrolledClasses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">신청한 수업이 없습니다</p>
              <p className="text-sm">학원 시간표에서 수업을 신청해주세요</p>
            </div>
          ) : (
            <MyTimetableGrid classes={enrolledClasses} onClassClick={setSelectedClass} currentUserId={targetUserId} />
          )}
        </CardContent>
      </Card>

      {enrolledClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">수업 상세 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enrolledClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-start gap-4 p-3 rounded-md bg-muted/50"
                  data-testid={`my-class-info-${cls.id}`}
                >
                  <div
                    className="w-3 h-full min-h-[60px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: cls.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{cls.name}</h3>
                      {isAssistantTeacher(cls, targetUserId) && cls.teacherId !== targetUserId && (
                        <Badge variant="outline" className="text-xs h-5 px-1.5 border-orange-400 text-orange-600 dark:text-orange-400">부담임</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{cls.startTime} - {cls.endTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {cls.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}
                        </span>
                      </div>
                      {cls.teacher && (
                        <div className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          <span>{cls.teacher.name} 선생님</span>
                        </div>
                      )}
                      {cls.classroom && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{cls.classroom}</span>
                        </div>
                      )}
                      {cls.center && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          <span>{cls.center.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">{cls.subject}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수업 정보</DialogTitle>
            <DialogDescription>신청한 수업을 확인하거나 삭제할 수 있습니다</DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-12 rounded-full"
                  style={{ backgroundColor: selectedClass.color }}
                />
                <div>
                  <h3 className="font-semibold text-lg">{selectedClass.name}</h3>
                  <p className="text-muted-foreground">{selectedClass.subject}반</p>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">요일</span>
                  <span>{selectedClass.days.map((d) => DAYS.find((day) => day.key === d)?.label).join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">시간</span>
                  <span>{selectedClass.startTime} - {selectedClass.endTime}</span>
                </div>
                {selectedClass.teacher && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">선생님</span>
                    <span>{selectedClass.teacher.name} 선생님</span>
                  </div>
                )}
                {selectedClass.classroom && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">강의실</span>
                    <span>{selectedClass.classroom}</span>
                  </div>
                )}
                {selectedClass.center && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">센터</span>
                    <span>{selectedClass.center.name}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedClass(null)}>
                  닫기
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteClick}
                  data-testid="button-delete-enrollment"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  수업 삭제
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 수업을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClass?.name} 수업이 나의 시간표에서 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
