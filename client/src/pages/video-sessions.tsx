import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Video, Users, Play, StopCircle, Trash2, ExternalLink, Calendar, Clock } from "lucide-react";
import { ManualButton } from "@/components/manual-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Class, type User, type VideoSession } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type EnrichedVideoSession = VideoSession & {
  hostName: string;
  className: string;
  participantCount: number;
  participants?: {
    id: string;
    studentId: string;
    studentName: string;
    studentGrade: string;
    joinedAt: Date | null;
  }[];
};

function SessionStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <Badge variant="default" className="bg-green-600 dark:bg-green-700" data-testid="badge-status-active">진행중</Badge>;
  }
  if (status === "scheduled") {
    return <Badge variant="secondary" data-testid="badge-status-scheduled">예정</Badge>;
  }
  return <Badge variant="outline" data-testid="badge-status-ended">종료됨</Badge>;
}

function SessionCard({ 
  session, 
  onJoin, 
  onStart,
  onEnd,
  onDelete,
  isTeacher,
}: { 
  session: EnrichedVideoSession;
  onJoin?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onDelete?: () => void;
  isTeacher: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SessionStatusBadge status={session.status} />
              <Badge variant="outline">{session.className}</Badge>
            </div>
            <CardTitle className="text-lg truncate" data-testid={`session-title-${session.id}`}>
              {session.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Users className="h-3 w-3" />
              <span>호스트: {session.hostName}</span>
              <span className="text-muted-foreground">|</span>
              <span>참여자: {session.participantCount}명</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground mb-4">
          {session.startedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              시작: {format(new Date(session.startedAt), "yyyy-MM-dd HH:mm", { locale: ko })}
            </div>
          )}
          {session.endedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              종료: {format(new Date(session.endedAt), "yyyy-MM-dd HH:mm", { locale: ko })}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {session.status === "active" && (
            <Button 
              onClick={onJoin}
              data-testid={`button-join-${session.id}`}
            >
              <Play className="h-4 w-4 mr-2" />
              입장하기
            </Button>
          )}
          {isTeacher && session.status === "scheduled" && (
            <Button 
              onClick={onStart}
              data-testid={`button-start-${session.id}`}
            >
              <Play className="h-4 w-4 mr-2" />
              시작하기
            </Button>
          )}
          {isTeacher && session.status === "active" && (
            <Button 
              variant="destructive"
              onClick={onEnd}
              data-testid={`button-end-${session.id}`}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              종료하기
            </Button>
          )}
          {isTeacher && session.status !== "active" && (
            <Button 
              variant="outline"
              size="icon"
              onClick={onDelete}
              data-testid={`button-delete-${session.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateSessionDialog({
  centerId,
  classes,
  students,
  teachers,
  currentUserId,
  userRole,
  onSuccess,
}: {
  centerId: string;
  classes: Class[];
  students: User[];
  teachers: User[];
  currentUserId: string;
  userRole: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const { toast } = useToast();

  const isAdminOrPrincipal = userRole >= UserRole.PRINCIPAL;
  const effectiveHostId = isAdminOrPrincipal ? selectedTeacherId : currentUserId;

  const { data: teacherClasses = [] } = useQuery<Class[]>({
    queryKey: ["/api/classes", centerId, "teacher", effectiveHostId],
    queryFn: async () => {
      const res = await fetch(`/api/classes?centerId=${centerId}&teacherId=${effectiveHostId}`);
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
    enabled: !!effectiveHostId && !!centerId,
  });

  const availableClasses = isAdminOrPrincipal ? teacherClasses : classes;

  const { data: enrollments = [] } = useQuery<{ id: string; studentId: string; classId: string }[]>({
    queryKey: ["/api/enrollments", centerId, selectedClassId],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      const allEnrollments = await res.json();
      return allEnrollments.filter((e: { classId: string }) => e.classId === selectedClassId);
    },
    enabled: !!selectedClassId && !!centerId,
  });

  const classStudentIds = enrollments.map(e => e.studentId);
  const classStudents = selectedClassId 
    ? students.filter(s => classStudentIds.includes(s.id))
    : students;

  const createMutation = useMutation({
    mutationFn: async (data: { 
      centerId: string; 
      classId: string; 
      title: string; 
      hostId: string;
      studentIds: string[];
    }) => {
      return await apiRequest("POST", "/api/video-sessions", data);
    },
    onSuccess: () => {
      toast({ title: "화상강의가 생성되었습니다" });
      setOpen(false);
      setTitle("");
      setSelectedTeacherId("");
      setSelectedClassId("");
      setSelectedStudents([]);
      onSuccess();
    },
    onError: () => {
      toast({ title: "화상강의 생성에 실패했습니다", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!title.trim() || !selectedClassId) {
      toast({ title: "제목과 수업을 선택해주세요", variant: "destructive" });
      return;
    }
    if (isAdminOrPrincipal && !selectedTeacherId) {
      toast({ title: "선생님을 선택해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      centerId,
      classId: selectedClassId,
      title: title.trim(),
      hostId: effectiveHostId,
      studentIds: selectedStudents,
    });
  };

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedClassId("");
    setSelectedStudents([]);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    if (selectedStudents.length === classStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(classStudents.map(s => s.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-session">
          <Plus className="h-4 w-4 mr-2" />
          화상강의 개설
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>새 화상강의 개설</DialogTitle>
          <DialogDescription>
            Jitsi Meet을 이용한 무료 화상강의를 개설합니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">강의 제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 중2 수학 보충수업"
              data-testid="input-session-title"
            />
          </div>
          
          {isAdminOrPrincipal && (
            <div className="space-y-2">
              <Label>선생님 선택</Label>
              <Select value={selectedTeacherId} onValueChange={handleTeacherChange}>
                <SelectTrigger data-testid="select-teacher">
                  <SelectValue placeholder="선생님을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>수업 선택</Label>
            <Select 
              value={selectedClassId} 
              onValueChange={setSelectedClassId}
              disabled={isAdminOrPrincipal && !selectedTeacherId}
            >
              <SelectTrigger data-testid="select-class">
                <SelectValue placeholder={isAdminOrPrincipal && !selectedTeacherId ? "먼저 선생님을 선택하세요" : "수업을 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}{cls.subject ? ` ${cls.subject}반` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>참여 학생 선택</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={selectAllStudents}
                data-testid="button-select-all"
              >
                {selectedStudents.length === classStudents.length ? "전체 해제" : "전체 선택"}
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-3">
              {classStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  학생이 없습니다
                </p>
              ) : (
                <div className="space-y-2">
                  {classStudents.map((student) => (
                    <div 
                      key={student.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                        data-testid={`checkbox-student-${student.id}`}
                      />
                      <label 
                        htmlFor={`student-${student.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {student.name} ({student.grade || "학년 미지정"})
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              선택된 학생: {selectedStudents.length}명
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={createMutation.isPending}
            data-testid="button-confirm-create"
          >
            {createMutation.isPending ? "생성 중..." : "개설하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JoinSessionDialog({ 
  session, 
  open, 
  onOpenChange,
}: { 
  session: EnrichedVideoSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!session) return null;

  const jitsiUrl = `https://meet.jit.si/${session.roomName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {session.title}
          </DialogTitle>
          <DialogDescription>
            {session.className} | 호스트: {session.hostName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 h-full min-h-[400px]">
          <iframe
            src={jitsiUrl}
            className="w-full h-full rounded-lg"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ border: "none" }}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={jitsiUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              새 탭에서 열기
            </a>
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoSessionsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [joinSession, setJoinSession] = useState<EnrichedVideoSession | null>(null);
  
  const isTeacher = user != null && user.role >= UserRole.TEACHER;
  const isStudent = user != null && user.role === UserRole.STUDENT;
  
  const centerId = selectedCenter?.id;

  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<EnrichedVideoSession[]>({
    queryKey: ["/api/video-sessions", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/video-sessions?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!centerId && isTeacher,
  });

  const { data: studentSessions = [], isLoading: studentSessionsLoading, refetch: refetchStudentSessions } = useQuery<EnrichedVideoSession[]>({
    queryKey: ["/api/video-sessions/student", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/video-sessions/student/${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!user?.id && isStudent,
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["/api/classes", centerId],
    enabled: !!centerId,
  });

  const { data: students = [] } = useQuery<User[]>({
    queryKey: ["/api/users/students", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/users?role=student&centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!centerId && isTeacher,
  });

  const { data: allStaff = [] } = useQuery<User[]>({
    queryKey: ["/api/users/staff", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/users?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch staff");
      const users: User[] = await res.json();
      return users.filter(u => u.role >= UserRole.TEACHER && u.role <= UserRole.PRINCIPAL);
    },
    enabled: !!centerId && isTeacher,
  });
  const teachers = allStaff;

  const startMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("POST", `/api/video-sessions/${sessionId}/start`);
    },
    onSuccess: () => {
      toast({ title: "화상강의가 시작되었습니다" });
      refetchSessions();
    },
  });

  const endMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("POST", `/api/video-sessions/${sessionId}/end`);
    },
    onSuccess: () => {
      toast({ title: "화상강의가 종료되었습니다" });
      refetchSessions();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("DELETE", `/api/video-sessions/${sessionId}`);
    },
    onSuccess: () => {
      toast({ title: "화상강의가 삭제되었습니다" });
      refetchSessions();
    },
  });

  const handleJoin = (session: EnrichedVideoSession) => {
    setJoinSession(session);
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (!centerId && isTeacher) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">센터를 선택해주세요.</p>
      </div>
    );
  }

  const displaySessions = isStudent ? studentSessions : sessions;
  const isLoading = isStudent ? studentSessionsLoading : sessionsLoading;

  const activeSessions = displaySessions?.filter(s => s.status === "active") || [];
  const scheduledSessions = displaySessions?.filter(s => s.status === "scheduled") || [];
  const endedSessions = displaySessions?.filter(s => s.status === "ended") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6" />
            화상강의
          </h1>
          <p className="text-muted-foreground mt-1">
            {isStudent 
              ? "참여 가능한 실시간 화상강의입니다" 
              : "Jitsi Meet을 이용한 무료 실시간 화상강의"
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManualButton menuKey="video-sessions" />
          {isTeacher && centerId && classes && students && user && (
            <CreateSessionDialog
              centerId={centerId}
              classes={classes}
              students={students}
              teachers={teachers}
              currentUserId={user.id}
              userRole={user.role}
              onSuccess={refetchSessions}
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-20 mb-2" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play className="h-5 w-5 text-green-500" />
                진행중인 강의
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isTeacher={!!isTeacher}
                    onJoin={() => handleJoin(session)}
                    onEnd={() => endMutation.mutate(session.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {scheduledSessions.length > 0 && isTeacher && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                예정된 강의
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scheduledSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isTeacher={!!isTeacher}
                    onStart={() => startMutation.mutate(session.id)}
                    onDelete={() => deleteMutation.mutate(session.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {endedSessions.length > 0 && isTeacher && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <StopCircle className="h-5 w-5 text-muted-foreground" />
                종료된 강의
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {endedSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isTeacher={!!isTeacher}
                    onDelete={() => deleteMutation.mutate(session.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {(!displaySessions || displaySessions.length === 0) && (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-1">화상강의가 없습니다</p>
                <p className="text-sm">
                  {isTeacher 
                    ? "새 화상강의를 개설하여 학생들과 실시간으로 소통하세요."
                    : "현재 진행 중인 화상강의가 없습니다."
                  }
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      <JoinSessionDialog
        session={joinSession}
        open={!!joinSession}
        onOpenChange={(open) => !open && setJoinSession(null)}
      />
    </div>
  );
}
