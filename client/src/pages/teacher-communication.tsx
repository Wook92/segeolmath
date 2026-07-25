import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle, Send, ArrowLeft, Users, User as UserIcon, ChevronDown, ChevronRight, Lock, Settings, Eye, EyeOff, Trash2, ImagePlus, Loader2, ImageOff } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isAssistantTeacher, type User, type Class, type Enrollment, type TeacherStudentMessage } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";

interface Conversation {
  teacherId?: string;
  studentId: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

export default function TeacherCommunicationPage() {
  const { user, selectedCenter, updateUser, selectedChild } = useAuth();
  
  // 학부모 계정인 경우 선택된 자녀를 사용, 아니면 본인 사용
  const effectiveUser = user?.role === UserRole.PARENT && selectedChild ? selectedChild : user;
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const hasInitialLoadRef = useRef<boolean>(false);
  
  // Password protection state (for students)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordSettingsOpen, setPasswordSettingsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const centerId = selectedCenter?.id;
  const isAdmin = user && user.role >= UserRole.ADMIN;
  const isPrincipal = user && user.role === UserRole.PRINCIPAL;
  const isTeacher = user && user.role === UserRole.TEACHER;
  // 학부모도 학생처럼 처리
  const isStudent = user && (user.role === UserRole.STUDENT || user.role === UserRole.PARENT);
  const isPrincipalOrAdmin = isAdmin || isPrincipal;

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: centerStudents = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${centerId}/students`],
    enabled: !!centerId,
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: [`/api/enrollments?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: teachers = [] } = useQuery<User[]>({
    queryKey: [`/api/centers/${centerId}/teachers`],
    enabled: !!centerId && !!(isPrincipalOrAdmin || isStudent || isTeacher),
  });

  // For students/parents: 서버에서 대화 가능한 선생님 목록을 받아온다.
  // (담임 + 수강 수업 담당 + 기존 대화 이력 선생님 포함, 고아 대화 자동 복구 수행)
  const { data: studentCommTeachers } = useQuery<User[]>({
    queryKey: ["/api/students/communication-teachers", centerId, effectiveUser?.id],
    queryFn: async () => {
      if (!centerId || !effectiveUser?.id || !user?.id) return [];
      const res = await fetch(`/api/students/${effectiveUser.id}/communication-teachers?centerId=${centerId}&actorId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isStudent && !!centerId && !!effectiveUser?.id && !!user?.id,
  });

  // For students/parents: calculate available teachers (homeroom + enrolled class teachers)
  // 학부모인 경우 선택된 자녀(effectiveUser)의 정보 사용. 서버 응답이 없으면 클라이언트 계산으로 폴백.
  const availableTeachersForStudent = isStudent ? (() => {
    if (studentCommTeachers && studentCommTeachers.length > 0) {
      return studentCommTeachers;
    }
    const teacherIds = new Set<string>();
    
    // Add homeroom teacher
    if (effectiveUser?.homeroomTeacherId) {
      teacherIds.add(effectiveUser.homeroomTeacherId);
    }
    
    // Add teachers of enrolled classes
    const studentEnrollments = enrollments.filter(e => e.studentId === effectiveUser?.id);
    const enrolledClassIds = studentEnrollments.map(e => e.classId);
    classes.filter(c => enrolledClassIds.includes(c.id) && c.teacherId)
      .forEach(c => teacherIds.add(c.teacherId!));
    
    return teachers.filter(t => teacherIds.has(t.id));
  })() : [];

  // State for student's selected teacher
  const [selectedTeacherForStudent, setSelectedTeacherForStudent] = useState<string>("");

  // For students/parents, auto-set selectedStudent to effectiveUser (self or selected child)
  useEffect(() => {
    if (isStudent && effectiveUser && !selectedStudent) {
      setSelectedStudent(effectiveUser);
    }
  }, [isStudent, effectiveUser, selectedStudent]);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/teacher-student-messages/conversations", centerId, user?.id],
    queryFn: async () => {
      if (!centerId || !user) return [];
      const response = await fetch(`/api/teacher-student-messages/conversations?actorId=${user.id}&centerId=${centerId}`);
      return response.json();
    },
    enabled: !!centerId && !!user && !!(isTeacher || isPrincipalOrAdmin),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const currentTeacherId = isStudent 
    ? selectedTeacherForStudent 
    : isPrincipalOrAdmin && selectedTeacher !== "all" 
      ? selectedTeacher 
      : isPrincipalOrAdmin && selectedTeacher === "all"
        ? "all"
        : user?.id || "";

  const { data: messages = [], refetch: refetchMessages } = useQuery<TeacherStudentMessage[]>({
    queryKey: ["/api/teacher-student-messages", centerId, currentTeacherId, selectedStudent?.id],
    queryFn: async () => {
      if (!centerId || !currentTeacherId || !selectedStudent) return [];
      const response = await fetch(
        `/api/teacher-student-messages?actorId=${user?.id}&centerId=${centerId}&teacherId=${currentTeacherId}&studentId=${selectedStudent.id}`
      );
      return response.json();
    },
    enabled: !!centerId && !!user && !!selectedStudent && !!currentTeacherId,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!messages || messages.length === 0) {
      hasInitialLoadRef.current = false;
      prevMessageCountRef.current = 0;
      return;
    }
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      prevMessageCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current);
      const incomingMessages = newMessages.filter(m => m.senderId !== user?.id && m.senderId !== effectiveUser?.id);
      if (incomingMessages.length > 0 && "Notification" in window && window.Notification.permission === "granted") {
        const lastMsg = incomingMessages[incomingMessages.length - 1];
        const shortContent = lastMsg.content.length > 100 ? lastMsg.content.substring(0, 100) + "..." : lastMsg.content;
        new window.Notification("새 메시지 도착", {
          body: shortContent,
          icon: "/icons/icon-192x192.png",
          tag: "teacher-comm-" + lastMsg.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, user?.id, effectiveUser?.id]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, imageObjectKey }: { content: string; imageObjectKey?: string }) => {
      if (!centerId || !user || !selectedStudent) throw new Error("필수 정보가 없습니다");
      
      let teacherId = isStudent ? selectedTeacherForStudent : currentTeacherId;
      // 관리자/원장이 "전체" 상태에서 답장 시, 기존 대화의 교사 ID 또는 학생의 담임 교사 사용
      if (isPrincipalOrAdmin && teacherId === "all") {
        const convTeacherId = conversations.find(c => c.studentId === selectedStudent.id)?.teacherId;
        teacherId = convTeacherId || selectedStudent.homeroomTeacherId || "";
        if (!teacherId) throw new Error("해당 학생의 담당 선생님을 찾을 수 없습니다");
      }
      const studentIdToUse = isStudent ? effectiveUser?.id : selectedStudent.id;
      
      return await apiRequest("POST", `/api/teacher-student-messages?actorId=${user.id}`, {
        centerId,
        teacherId,
        studentId: studentIdToUse,
        content,
        imageObjectKey,
      });
    },
    onSuccess: () => {
      setMessageInput("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/unread-total"] });
    },
    onError: (error: any) => {
      toast({
        title: "전송 실패",
        description: error.message || "메시지 전송에 실패했습니다",
        variant: "destructive",
      });
    },
  });

  // Password protection mutations
  const setPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!user) throw new Error("사용자 정보가 없습니다");
      return await apiRequest("POST", `/api/users/${user.id}/chat-password`, { password });
    },
    onSuccess: (_data, password) => {
      toast({ title: "비밀번호 설정 완료", description: "톡방 입장 비밀번호가 설정되었습니다" });
      setPasswordSettingsOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      updateUser({ chatPassword: password });
      setIsUnlocked(false);
    },
    onError: (error: any) => {
      toast({ title: "설정 실패", description: error.message, variant: "destructive" });
    },
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!user) throw new Error("사용자 정보가 없습니다");
      const res = await apiRequest("POST", `/api/users/${user.id}/verify-chat-password`, { password });
      return res.json();
    },
    onSuccess: (data: { valid: boolean }) => {
      if (data.valid) {
        setIsUnlocked(true);
        setPasswordInput("");
      } else {
        toast({ title: "비밀번호 오류", description: "비밀번호가 일치하지 않습니다", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "확인 실패", description: "비밀번호 확인에 실패했습니다", variant: "destructive" });
    },
  });

  const removePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다");
      return await apiRequest("DELETE", `/api/users/${user.id}/chat-password`);
    },
    onSuccess: () => {
      toast({ title: "비밀번호 해제", description: "톡방 입장 비밀번호가 해제되었습니다" });
      setPasswordSettingsOpen(false);
      updateUser({ chatPassword: null });
      setIsUnlocked(true);
    },
    onError: (error: any) => {
      toast({ title: "해제 실패", description: error.message, variant: "destructive" });
    },
  });

  // Check if student has password set
  const hasPasswordSet = isStudent && user?.chatPassword;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedStudent || !centerId || !user || !currentTeacherId) return;
    if (messages.length === 0) return;
    // 관리자/원장: 서버 GET 단계에서 본인이 수신자인 메시지를 읽음 처리하므로,
    // 대화 목록의 미읽음(빨간 1)이 갱신되도록 캐시만 무효화한다.
    if (isPrincipalOrAdmin) {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/unread-total"] });
      return;
    }
    const hasUnread = messages.some(m => m.receiverId === user.id && !m.isRead);
    if (!hasUnread) return;
    const teacherIdForRead = currentTeacherId;
    if (!teacherIdForRead || teacherIdForRead === "all") return;
    apiRequest("PATCH", `/api/teacher-student-messages/read?actorId=${user.id}`, {
      centerId,
      teacherId: teacherIdForRead,
      studentId: selectedStudent.id,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher-student-messages/unread-total"] });
      refetchMessages();
    }).catch(() => {});
  }, [selectedStudent?.id, messages.length, currentTeacherId, isPrincipalOrAdmin]);

  const allMyClasses = classes.filter(c => {
    if (isTeacher) return c.teacherId === user?.id || isAssistantTeacher(c, user?.id);
    if (isPrincipalOrAdmin && selectedTeacher !== "all") return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
    return true;
  });

  const ownClasses = isTeacher ? classes.filter(c => c.teacherId === user?.id) : allMyClasses;
  const assistantClasses = isTeacher ? classes.filter(c => isAssistantTeacher(c, user?.id) && c.teacherId !== user?.id) : [];
  const hasAssistantClasses = assistantClasses.length > 0;
  const myClasses = isTeacher && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : allMyClasses;

  const getStudentsForClass = (classId: string) => {
    if (classId === "all") {
      if (isTeacher) {
        const myClassIds = new Set(myClasses.map(c => c.id));
        const studentsInMyClasses = new Set(
          enrollments.filter(e => myClassIds.has(e.classId)).map(e => e.studentId)
        );
        return centerStudents.filter(s => studentsInMyClasses.has(s.id));
      }
      if (isPrincipalOrAdmin && selectedTeacher === "all") {
        return centerStudents;
      }
      if (isPrincipalOrAdmin && selectedTeacher !== "all") {
        const teacherClassIds = new Set(myClasses.map(c => c.id));
        const studentsInTeacherClasses = new Set(
          enrollments.filter(e => teacherClassIds.has(e.classId)).map(e => e.studentId)
        );
        return centerStudents.filter(s => studentsInTeacherClasses.has(s.id));
      }
      return centerStudents;
    }
    const studentIds = enrollments.filter(e => e.classId === classId).map(e => e.studentId);
    return centerStudents.filter(s => studentIds.includes(s.id));
  };

  const studentsForClass = getStudentsForClass(selectedClass);

  const getUnreadCount = (studentId: string) => {
    const conv = conversations.find(c => c.studentId === studentId);
    return conv?.unreadCount || 0;
  };

  const getLastMessage = (studentId: string) => {
    const conv = conversations.find(c => c.studentId === studentId);
    return conv?.lastMessage || "";
  };

  const getLastMessageTime = (studentId: string) => {
    const conv = conversations.find(c => c.studentId === studentId);
    if (!conv?.lastMessageAt) return "";
    const date = new Date(conv.lastMessageAt);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return format(date, "HH:mm", { locale: ko });
    }
    return format(date, "MM/dd", { locale: ko });
  };

  // 메시지 발신자가 선생님인지 학부모/학생 측인지 구분 (관리자/원장이 대화 열람 시 사용)
  const getSenderInfo = useCallback((senderId: string) => {
    const teacher = teachers.find(t => t.id === senderId);
    if (teacher) return { name: teacher.name, role: "teacher" as const };
    const student = centerStudents.find(s => s.id === senderId);
    return { name: student?.name ?? "", role: "family" as const };
  }, [teachers, centerStudents]);

  // 발신자 ID로 선생님 이름을 찾는 맵 (학생/학부모 화면에서 이전/현재 선생님 구분에 사용)
  const teacherNameById = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach(t => map.set(t.id, t.name));
    (studentCommTeachers ?? []).forEach(t => map.set(t.id, t.name));
    return map;
  }, [teachers, studentCommTeachers]);

  const studentsToShow = useMemo(() => {
    return [...studentsForClass].sort((a, b) => {
      const unreadA = getUnreadCount(a.id);
      const unreadB = getUnreadCount(b.id);
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadA === 0 && unreadB > 0) return 1;
      const convA = conversations.find(c => c.studentId === a.id);
      const convB = conversations.find(c => c.studentId === b.id);
      const timeA = convA?.lastMessageAt ? new Date(convA.lastMessageAt).getTime() : 0;
      const timeB = convB?.lastMessageAt ? new Date(convB.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [studentsForClass, conversations]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate({ content: messageInput.trim() });
  };

  // 이미지 전송 (R2 업로드 후 메시지로 전송, 2주 후 자동 삭제됨)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    prefix: "chat",
    centerId: centerId || undefined,
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "이미지 파일만 전송할 수 있습니다", variant: "destructive" });
      return;
    }
    const result = await uploadFile(file);
    if (!result || !result.objectPath) {
      toast({ title: "사진 업로드 실패", description: "잠시 후 다시 시도해주세요", variant: "destructive" });
      return;
    }
    sendMessageMutation.mutate({
      content: messageInput.trim(),
      imageObjectKey: result.objectPath,
    });
  };

  // 2주(14일) 지난 이미지는 R2에서 삭제되므로 만료 표시
  const isImageExpired = (createdAt: string | Date | null | undefined) => {
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() > 14 * 24 * 60 * 60 * 1000;
  };

  // 터치 기기(모바일)에서는 엔터가 줄바꿈, 전송 버튼으로만 전송
  const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (isTouchDevice) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const messagePlaceholder = isTouchDevice
    ? "메시지를 입력하세요..."
    : "메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)";

  if (!user || !centerId) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (isStudent) {
    if (availableTeachersForStudent.length === 0) {
      return (
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">대화할 수 있는 선생님이 없습니다. 담임 선생님 지정이나 수업 수강 신청이 필요합니다.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const currentSelectedTeacher = availableTeachersForStudent.find(t => t.id === selectedTeacherForStudent)
      || teachers.find(t => t.id === selectedTeacherForStudent);
    // 학부모인 경우 effectiveUser(자녀)의 정보 사용
    const isHomeroomTeacher = effectiveUser?.homeroomTeacherId === selectedTeacherForStudent;

    // Get classes that this teacher teaches for the current student
    const studentEnrollments = enrollments.filter(e => e.studentId === effectiveUser?.id);
    const enrolledClassIds = studentEnrollments.map(e => e.classId);
    const teacherClassesForStudent = classes.filter(c => 
      enrolledClassIds.includes(c.id) && c.teacherId === selectedTeacherForStudent
    );

    // Day translation helper
    const dayToKorean: Record<string, string> = {
      'mon': '월', 'tue': '화', 'wed': '수', 'thu': '목', 
      'fri': '금', 'sat': '토', 'sun': '일'
    };

    // Get classes for any teacher (for card display)
    const getTeacherClassesForStudent = (teacherId: string) => {
      return classes.filter(c => 
        enrolledClassIds.includes(c.id) && c.teacherId === teacherId
      );
    };

    // Format class info
    const getClassInfo = (cls: Class) => {
      const days = cls.days?.map(d => dayToKorean[d] || d).join(', ') || '';
      return `${cls.name} ${cls.subject}반 (${days} ${cls.startTime}~${cls.endTime})`;
    };
    
    // Format class display name
    const getClassDisplayName = (cls: Class) => {
      return `${cls.name} ${cls.subject}반`;
    };

    // Teacher selection view (card-based)
    if (!selectedTeacherForStudent) {
      return (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">선생님과 톡하기</h1>
            <ManualButton menuKey="teacher-communication" />
          </div>
          <p className="text-sm text-muted-foreground">대화할 선생님을 선택하세요</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableTeachersForStudent.map((teacher) => {
              const teacherClasses = getTeacherClassesForStudent(teacher.id);
              const isHomeroom = user.homeroomTeacherId === teacher.id;
              return (
                <Card 
                  key={teacher.id} 
                  className="hover-elevate transition-all cursor-pointer"
                  data-testid={`card-teacher-${teacher.id}`}
                  onClick={() => setSelectedTeacherForStudent(teacher.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                          <UserIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-semibold text-base">{teacher.name}</span>
                          {isHomeroom && (
                            <Badge variant="secondary" className="text-xs">담임</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Dialog open={passwordSettingsOpen} onOpenChange={setPasswordSettingsOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-password-settings-${teacher.id}`}
                            >
                              {hasPasswordSet ? (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Settings className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
                            <DialogHeader>
                              <DialogTitle>톡방 비밀번호 설정</DialogTitle>
                              <DialogDescription>
                                {hasPasswordSet 
                                  ? "톡방 입장 비밀번호를 변경하거나 해제할 수 있습니다."
                                  : "톡방에 입장할 때 비밀번호를 요구하도록 설정합니다."}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="new-password-card">새 비밀번호</Label>
                                <div className="relative">
                                  <Input
                                    id="new-password-card"
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="4자리 이상 입력"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    data-testid="input-new-chat-password-card"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                  >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="confirm-password-card">비밀번호 확인</Label>
                                <Input
                                  id="confirm-password-card"
                                  type="password"
                                  placeholder="비밀번호 재입력"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  data-testid="input-confirm-chat-password-card"
                                />
                              </div>
                              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-sm text-destructive">비밀번호가 일치하지 않습니다</p>
                              )}
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-2">
                              {hasPasswordSet && (
                                <Button
                                  variant="destructive"
                                  onClick={() => removePasswordMutation.mutate()}
                                  disabled={removePasswordMutation.isPending}
                                  className="w-full sm:w-auto"
                                  data-testid="button-remove-chat-password-card"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  비밀번호 해제
                                </Button>
                              )}
                              <Button
                                onClick={() => setPasswordMutation.mutate(newPassword)}
                                disabled={
                                  !newPassword || 
                                  newPassword.length < 4 || 
                                  newPassword !== confirmPassword ||
                                  setPasswordMutation.isPending
                                }
                                className="w-full sm:w-auto"
                                data-testid="button-save-chat-password-card"
                              >
                                {setPasswordMutation.isPending ? "저장 중..." : hasPasswordSet ? "비밀번호 변경" : "비밀번호 설정"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                    {teacherClasses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {teacherClasses.map((cls) => (
                          <Badge 
                            key={cls.id}
                            variant="secondary"
                            className="whitespace-nowrap text-xs"
                          >
                            {getClassDisplayName(cls)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {teacherClasses.length === 0 && isHomeroom && (
                      <p className="text-xs text-muted-foreground">담임 선생님</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // Password lock screen after teacher selection
    if (hasPasswordSet && !isUnlocked) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100dvh-9.5rem)] p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>톡방 잠금</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                비밀번호를 입력하여 톡방에 입장하세요
              </p>
              <div className="relative">
                <Input
                  type={showPasswordInput ? "text" : "password"}
                  placeholder="비밀번호 입력"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && passwordInput) {
                      verifyPasswordMutation.mutate(passwordInput);
                    }
                  }}
                  data-testid="input-chat-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPasswordInput(!showPasswordInput)}
                >
                  {showPasswordInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => verifyPasswordMutation.mutate(passwordInput)}
                disabled={!passwordInput || verifyPasswordMutation.isPending}
                data-testid="button-unlock-chat"
              >
                {verifyPasswordMutation.isPending ? "확인 중..." : "입장하기"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelectedTeacherForStudent("")}
              >
                뒤로가기
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Chat view with selected teacher
    return (
      <div className="fixed inset-0 top-[57px] bottom-[65px] md:bottom-0 md:left-[var(--sidebar-width,0px)] z-30 flex flex-col overflow-hidden bg-background">
        <div className="flex items-center gap-3 p-4 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTeacherForStudent("")}
            data-testid="button-back-to-teachers"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{currentSelectedTeacher?.name || "선생님"}</h2>
              {isHomeroomTeacher && (
                <Badge variant="secondary" className="text-xs">담임</Badge>
              )}
            </div>
            {teacherClassesForStudent.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {teacherClassesForStudent.map((cls) => (
                  <span 
                    key={cls.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                  >
                    {cls.name} {cls.subject}반
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={passwordSettingsOpen} onOpenChange={setPasswordSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-chat-settings">
                  <Settings className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>톡방 비밀번호 설정</DialogTitle>
                  <DialogDescription>
                    {hasPasswordSet 
                      ? "톡방 입장 비밀번호를 변경하거나 해제할 수 있습니다."
                      : "톡방에 입장할 때 비밀번호를 요구하도록 설정합니다."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">새 비밀번호</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="4자리 이상 입력"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        data-testid="input-new-chat-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">비밀번호 확인</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="비밀번호 재입력"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-chat-password"
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-destructive">비밀번호가 일치하지 않습니다</p>
                  )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  {hasPasswordSet && (
                    <Button
                      variant="destructive"
                      onClick={() => removePasswordMutation.mutate()}
                      disabled={removePasswordMutation.isPending}
                      className="w-full sm:w-auto"
                      data-testid="button-remove-chat-password"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      비밀번호 해제
                    </Button>
                  )}
                  <Button
                    onClick={() => setPasswordMutation.mutate(newPassword)}
                    disabled={
                      !newPassword || 
                      newPassword.length < 4 || 
                      newPassword !== confirmPassword ||
                      setPasswordMutation.isPending
                    }
                    className="w-full sm:w-auto"
                    data-testid="button-save-chat-password"
                  >
                    {setPasswordMutation.isPending ? "저장 중..." : hasPasswordSet ? "비밀번호 변경" : "비밀번호 설정"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMine = msg.senderId === user.id || (effectiveUser?.id ? msg.senderId === effectiveUser.id : false);
              const isTeacherSender = !isMine && teacherNameById.has(msg.senderId);
              // 인수인계로 teacherId가 바뀐 경우, 보낸 선생님(senderId)이 현재 담당(teacherId)과 다르면 이전 선생님 메시지
              const isPreviousTeacherMsg = isTeacherSender && !!msg.teacherId && msg.senderId !== msg.teacherId;
              const senderTeacherName = !isMine ? (teacherNameById.get(msg.senderId) ?? "") : "";
              return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isMine ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "flex flex-col gap-1 max-w-[70%]",
                  isMine ? "items-end" : "items-start"
                )}>
                  {!isMine && (
                    <div className="flex items-center gap-1.5 px-1">
                      {isPreviousTeacherMsg && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 leading-4 bg-muted-foreground/70 hover:bg-muted-foreground/70 text-white"
                          data-testid={`badge-previous-teacher-${msg.id}`}
                        >
                          이전 담당
                        </Badge>
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isPreviousTeacherMsg
                            ? "text-muted-foreground"
                            : "text-blue-700 dark:text-blue-300"
                        )}
                        data-testid={`text-sender-name-${msg.id}`}
                      >
                        {senderTeacherName ? `${senderTeacherName} 선생님` : "선생님"}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2",
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : isPreviousTeacherMsg
                          ? "bg-muted/50 border border-dashed border-muted-foreground/40 rounded-bl-sm"
                          : "bg-muted rounded-bl-sm"
                    )}
                  >
                    {msg.imageUrl && (
                      isImageExpired(msg.createdAt) ? (
                        <div className="flex items-center gap-1.5 text-xs opacity-70 py-1" data-testid={`text-image-expired-${msg.id}`}>
                          <ImageOff className="w-4 h-4" />
                          보관 기간(2주)이 지난 사진입니다
                        </div>
                      ) : (
                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.imageUrl}
                            alt="첨부 사진"
                            className="max-w-full max-h-60 rounded-lg my-1"
                            loading="lazy"
                            data-testid={`img-message-${msg.id}`}
                          />
                        </a>
                      )
                    )}
                    {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                    <p className={cn(
                      "text-xs mt-1",
                      isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {msg.createdAt && format(new Date(msg.createdAt), "HH:mm", { locale: ko })}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t bg-background shrink-0">
          <div className="flex gap-2 items-end">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
              data-testid="input-image-file"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || sendMessageMutation.isPending}
              data-testid="button-attach-image"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            </Button>
            <Textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={messagePlaceholder}
              className="flex-1 min-h-[40px] max-h-40 resize-none"
              rows={1}
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedStudent) {
    return (
      <div className="fixed inset-0 top-[57px] bottom-[65px] md:bottom-0 md:left-[var(--sidebar-width,0px)] z-30 flex flex-col overflow-hidden bg-background">
        <div className="flex items-center gap-3 p-4 border-b bg-background shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedStudent(null)}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{selectedStudent.name}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedStudent.grade} · {selectedStudent.school}
              {isPrincipalOrAdmin && selectedTeacher === "all" && (() => {
                const conv = conversations.find(c => c.studentId === selectedStudent.id);
                if (conv?.teacherId) {
                  const teacher = teachers.find(t => t.id === conv.teacherId);
                  return teacher ? ` · 담당: ${teacher.name}` : "";
                }
                return "";
              })()}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>아직 대화가 없습니다.</p>
                <p className="text-sm">첫 메시지를 보내보세요!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === user?.id || (effectiveUser?.id ? msg.senderId === effectiveUser.id : false);
                const senderInfo = !isMine ? getSenderInfo(msg.senderId) : null;
                const isTeacherMsg = senderInfo?.role === "teacher";
                // 인수인계로 teacherId가 바뀐 경우, 보낸 선생님이 현재 담당과 다르면 이전 담당 선생님 메시지
                const isPreviousTeacherMsg = isTeacherMsg && !!msg.teacherId && msg.senderId !== msg.teacherId;
                return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isMine ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "flex flex-col gap-1 max-w-[70%]",
                    isMine ? "items-end" : "items-start"
                  )}>
                    {!isMine && senderInfo && (
                      <div className="flex items-center gap-1.5 px-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0 leading-4",
                            isPreviousTeacherMsg
                              ? "bg-muted-foreground/70 hover:bg-muted-foreground/70 text-white"
                              : isTeacherMsg
                                ? "bg-blue-600 hover:bg-blue-600 text-white"
                                : "bg-amber-500 hover:bg-amber-500 text-white"
                          )}
                          data-testid={`badge-sender-role-${msg.id}`}
                        >
                          {isPreviousTeacherMsg ? "이전 담당" : isTeacherMsg ? "선생님" : "학부모"}
                        </Badge>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            isPreviousTeacherMsg
                              ? "text-muted-foreground"
                              : isTeacherMsg ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-400"
                          )}
                          data-testid={`text-sender-name-${msg.id}`}
                        >
                          {isTeacherMsg
                            ? (senderInfo.name ? `${senderInfo.name} 선생님` : "선생님")
                            : (senderInfo.name || "학부모")}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex items-end gap-1", isMine ? "flex-row-reverse" : "flex-row")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : isPreviousTeacherMsg
                              ? "bg-muted/50 border border-dashed border-muted-foreground/40 rounded-bl-sm"
                              : isTeacherMsg
                                ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-bl-sm"
                                : "bg-muted rounded-bl-sm"
                        )}
                      >
                        {msg.imageUrl && (
                          isImageExpired(msg.createdAt) ? (
                            <div className="flex items-center gap-1.5 text-xs opacity-70 py-1" data-testid={`text-image-expired-${msg.id}`}>
                              <ImageOff className="w-4 h-4" />
                              보관 기간(2주)이 지난 사진입니다
                            </div>
                          ) : (
                            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={msg.imageUrl}
                                alt="첨부 사진"
                                className="max-w-full max-h-60 rounded-lg my-1"
                                loading="lazy"
                                data-testid={`img-message-${msg.id}`}
                              />
                            </a>
                          )
                        )}
                        {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        <p className={cn(
                          "text-xs mt-1",
                          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {msg.createdAt && format(new Date(msg.createdAt), "HH:mm", { locale: ko })}
                        </p>
                      </div>
                      {isMine && !msg.isRead && (
                        <span
                          className="text-[11px] font-bold text-yellow-500 leading-none mb-1"
                          data-testid={`indicator-unread-${msg.id}`}
                        >
                          1
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t bg-background shrink-0">
          <div className="flex gap-2 items-end">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
              data-testid="input-image-file"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || sendMessageMutation.isPending}
              data-testid="button-attach-image"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            </Button>
            <Textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={messagePlaceholder}
              className="flex-1 min-h-[40px] max-h-40 resize-none"
              rows={1}
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">교사소통</h1>
        </div>
        <ManualButton menuKey="teacher-communication" />
      </div>

      {isPrincipalOrAdmin && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium shrink-0 mr-1">선생님:</span>
              <Button
                variant={selectedTeacher === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTeacher("all")}
                data-testid="btn-teacher-all"
              >
                전체
              </Button>
              {teachers.map((teacher) => (
                <Button
                  key={teacher.id}
                  variant={selectedTeacher === teacher.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTeacher(teacher.id)}
                  data-testid={`btn-teacher-${teacher.id}`}
                >
                  {teacher.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isTeacher && hasAssistantClasses && (
        <TeacherClassTabs
          teacherViewTab={teacherViewTab}
          onTabChange={(tab) => { setTeacherViewTab(tab); setSelectedClass("all"); }}
          ownCount={ownClasses.length}
          assistantCount={assistantClasses.length}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium shrink-0 mr-1">반:</span>
            <Button
              variant={selectedClass === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedClass("all")}
              data-testid="btn-class-all"
            >
              전체
            </Button>
            {myClasses.map((cls) => (
              <Button
                key={cls.id}
                variant={selectedClass === cls.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedClass(cls.id)}
                data-testid={`btn-class-${cls.id}`}
              >
                {cls.name} {cls.subject}반
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            학생 목록 ({studentsToShow.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto">
            {studentsToShow.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>표시할 학생이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y">
                {studentsToShow.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className="w-full flex items-center gap-3 p-4 hover-elevate text-left"
                    data-testid={`button-student-${student.id}`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                      <UserIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{student.name}</span>
                        <Badge variant="outline" className="text-xs">{student.grade}</Badge>
                        {getUnreadCount(student.id) > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {getUnreadCount(student.id)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getLastMessage(student.id) || student.school || "대화 없음"}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {getLastMessageTime(student.id)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
