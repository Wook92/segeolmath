import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Users, CheckSquare, Square, Loader2, History, Phone, Search, Settings, Plus, Pencil, Trash2, MessageSquare, Zap, X, Clock, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { isAssistantTeacher, type User, type Class, type SmsHistory, type SmsTemplate, type ScheduledSmsMessage } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { UserRole } from "@shared/schema";

const isPhoneLike = (v?: string | null): boolean => {
  if (!v) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 11;
};

const getOwnPhone = (s: any): string =>
  s?.studentPhone || s?.phone || (isPhoneLike(s?.username) ? s.username : "");

export default function ContactParentsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");
  const [phoneTypes, setPhoneTypes] = useState<Set<"mother" | "father" | "student">>(new Set<"mother" | "father" | "student">(["mother"]));

  const togglePhoneType = (type: "mother" | "father" | "student") => {
    setPhoneTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };
  const [activeTab, setActiveTab] = useState("send");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");

  const gradeOptions = [
    { value: "all", label: "전체" },
    { value: "초1", label: "초1" },
    { value: "초2", label: "초2" },
    { value: "초3", label: "초3" },
    { value: "초4", label: "초4" },
    { value: "초5", label: "초5" },
    { value: "초6", label: "초6" },
    { value: "중1", label: "중1" },
    { value: "중2", label: "중2" },
    { value: "중3", label: "중3" },
    { value: "고1", label: "고1" },
    { value: "고2", label: "고2" },
    { value: "고3", label: "고3" },
    { value: "성인", label: "성인" },
  ];

  const centerId = selectedCenter?.id;
  const isAdminOrPrincipal = user && user.role >= UserRole.PRINCIPAL;
  const isTeacherOnly = user && user.role === UserRole.TEACHER;

  const { data: teachers } = useQuery<any[]>({
    queryKey: [`/api/centers/${centerId}/teachers`],
    enabled: !!centerId && !!isAdminOrPrincipal,
  });

  const { data: classes } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${centerId}`],
    enabled: !!centerId,
  });

  const { data: smsHistoryData = [], isLoading: historyLoading } = useQuery<SmsHistory[]>({
    queryKey: ["/api/sms/history", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const response = await fetch(`/api/sms/history?centerId=${centerId}`);
      return response.json();
    },
    enabled: !!centerId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: smsTemplatesData = [] } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/sms-templates", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const response = await fetch(`/api/sms-templates?centerId=${centerId}`);
      return response.json();
    },
    enabled: !!centerId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { centerId: string; title: string; message: string; createdBy: string }) => {
      const response = await apiRequest("POST", "/api/sms-templates", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "템플릿이 저장되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates", centerId] });
      setTemplateDialogOpen(false);
      setTemplateTitle("");
      setTemplateMessage("");
      setEditingTemplate(null);
    },
    onError: () => toast({ title: "템플릿 저장 실패", variant: "destructive" }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; message: string }) => {
      const response = await apiRequest("PUT", `/api/sms-templates/${data.id}`, { title: data.title, message: data.message });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "템플릿이 수정되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates", centerId] });
      setTemplateDialogOpen(false);
      setTemplateTitle("");
      setTemplateMessage("");
      setEditingTemplate(null);
    },
    onError: () => toast({ title: "템플릿 수정 실패", variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sms-templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "템플릿이 삭제되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates", centerId] });
    },
    onError: () => toast({ title: "템플릿 삭제 실패", variant: "destructive" }),
  });

  const teacherClasses = classes?.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user.id || isAssistantTeacher(c, user.id);
    if (!selectedTeacher) return true;
    return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
  }) ?? [];

  const ownClasses = isTeacherOnly
    ? teacherClasses.filter((c) => c.teacherId === user!.id)
    : teacherClasses;
  const assistantClasses = isTeacherOnly
    ? teacherClasses.filter((c) => isAssistantTeacher(c, user!.id) && c.teacherId !== user!.id)
    : [];
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : teacherClasses;

  const { data: classStudents } = useQuery<any[]>({
    queryKey: ["/api/classes", selectedClass, "students"],
    enabled: selectedClass !== "all" && !!selectedClass,
  });

  const { data: centerStudents, isLoading: centerStudentsLoading } = useQuery<any[]>({
    queryKey: [`/api/centers/${centerId}/students`],
    enabled: !!centerId,
  });

  const { data: enrollments } = useQuery<any[]>({
    queryKey: [`/api/enrollments?centerId=${centerId}`],
    enabled: !!centerId,
  });
  
  const isDataLoading = centerStudentsLoading;

  const filteredStudents = (() => {
    let students: any[] = [];
    
    // Priority 1: Specific class selected
    if (selectedClass !== "all" && classStudents) {
      students = classStudents;
    } 
    // Priority 2: Teacher only role - filter by teacher's classes
    else if (isTeacherOnly && centerStudents && enrollments) {
      const myClassIds = new Set(displayClasses.map(c => c.id));
      const studentsInMyClasses = new Set(
        enrollments
          .filter(e => myClassIds.has(e.classId))
          .map(e => e.studentId)
      );
      students = centerStudents.filter(s => studentsInMyClasses.has(s.id));
    } 
    // Priority 3: Admin/Principal with specific teacher selected - filter by teacher's classes
    else if (isAdminOrPrincipal && selectedTeacher && selectedTeacher.length > 0 && centerStudents && enrollments) {
      const teacherClassIds = new Set(teacherClasses.map(c => c.id));
      const studentsInTeacherClasses = new Set(
        enrollments
          .filter(e => teacherClassIds.has(e.classId))
          .map(e => e.studentId)
      );
      students = centerStudents.filter(s => studentsInTeacherClasses.has(s.id));
    } 
    // Priority 4: Admin/Principal with "all teachers" (or no selection) - show all center students
    else if (centerStudents) {
      students = centerStudents;
    }

    // Apply grade filter
    if (selectedGrade !== "all") {
      students = students.filter(s => s.grade === selectedGrade);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      students = students.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.motherPhone?.includes(query) ||
        s.fatherPhone?.includes(query) ||
        getOwnPhone(s).includes(query)
      );
    }

    // Only show students with at least one contactable phone number
    return students.filter(s => s.motherPhone || s.fatherPhone || getOwnPhone(s));
  })();

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s: any) => selectedStudentIds.has(s.id));

  const handleSelectAll = () => {
    const next = new Set(selectedStudentIds);
    if (allFilteredSelected) {
      filteredStudents.forEach((s: any) => next.delete(s.id));
    } else {
      filteredStudents.forEach((s: any) => next.add(s.id));
    }
    setSelectedStudentIds(next);
  };

  // 선택된 학생 목록 (학년 필터와 무관하게 유지)
  const selectedStudents = (() => {
    const lookup = new Map<string, any>();
    (centerStudents || []).forEach((s: any) => lookup.set(s.id, s));
    (users || []).forEach((u: any) => { if (!lookup.has(u.id)) lookup.set(u.id, u); });
    return Array.from(selectedStudentIds)
      .map(id => lookup.get(id))
      .filter(Boolean);
  })();

  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const sendBulkSmsMutation = useMutation({
    mutationFn: async (data: { studentIds: string[]; message: string; phoneTypes: string[]; actorId: string }) => {
      const response = await apiRequest("POST", "/api/sms/bulk-send", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "문자 발송 완료",
        description: `${data.successCount}건 발송 성공, ${data.failCount}건 실패`,
      });
      setSelectedStudentIds(new Set());
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/sms/history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "문자 발송 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: scheduledSmsData = [], isLoading: scheduledLoading } = useQuery<ScheduledSmsMessage[]>({
    queryKey: ["/api/sms/scheduled", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const response = await fetch(`/api/sms/scheduled?centerId=${centerId}`);
      return response.json();
    },
    enabled: !!centerId,
  });

  const scheduleSmsMutation = useMutation({
    mutationFn: async (data: { centerId: string; studentIds: string[]; message: string; phoneTypes: string[]; scheduledAt: string; actorId: string }) => {
      const response = await apiRequest("POST", "/api/sms/schedule", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "예약 문자가 등록되었습니다",
        description: "예약한 시간에 자동으로 발송됩니다.",
      });
      setSelectedStudentIds(new Set());
      setMessage("");
      setIsScheduled(false);
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["/api/sms/scheduled", centerId] });
    },
    onError: (error: Error) => {
      toast({
        title: "예약 등록 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelScheduledSmsMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sms/scheduled/${id}`);
    },
    onSuccess: () => {
      toast({ title: "예약이 취소되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/scheduled", centerId] });
    },
    onError: (error: Error) => {
      toast({ title: "예약 취소 실패", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (selectedStudentIds.size === 0) {
      toast({
        title: "학생을 선택해주세요",
        description: "문자를 보낼 학생을 한 명 이상 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "메시지를 입력해주세요",
        description: "보낼 메시지 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (phoneTypes.size === 0) {
      toast({
        title: "수신 대상을 선택해주세요",
        description: "어머니, 아버지, 학생 중 최소 한 명을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (isScheduled) {
      if (!scheduledAt) {
        toast({
          title: "예약 시간을 선택해주세요",
          description: "예약 발송할 날짜와 시간을 선택해주세요.",
          variant: "destructive",
        });
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        toast({
          title: "예약 시간이 올바르지 않습니다",
          description: "현재 시각보다 이후 시간을 선택해주세요.",
          variant: "destructive",
        });
        return;
      }
      if (!centerId) {
        toast({ title: "센터 정보를 찾을 수 없습니다", variant: "destructive" });
        return;
      }
      scheduleSmsMutation.mutate({
        centerId,
        studentIds: Array.from(selectedStudentIds),
        message: message.trim(),
        phoneTypes: Array.from(phoneTypes),
        scheduledAt: new Date(scheduledAt).toISOString(),
        actorId: user?.id || "",
      });
      return;
    }

    sendBulkSmsMutation.mutate({
      studentIds: Array.from(selectedStudentIds),
      message: message.trim(),
      phoneTypes: Array.from(phoneTypes),
      actorId: user?.id || "",
    });
  };

  const handleOpenTemplateDialog = (template?: SmsTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateTitle(template.title);
      setTemplateMessage(template.message);
    } else {
      setEditingTemplate(null);
      setTemplateTitle("");
      setTemplateMessage("");
    }
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateTitle.trim() || !templateMessage.trim()) {
      toast({ title: "제목과 내용을 모두 입력해주세요", variant: "destructive" });
      return;
    }
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, title: templateTitle.trim(), message: templateMessage.trim() });
    } else {
      createTemplateMutation.mutate({ centerId: centerId!, title: templateTitle.trim(), message: templateMessage.trim(), createdBy: user?.id || "" });
    }
  };

  const handleQuickSendTemplate = (template: SmsTemplate) => {
    if (selectedStudentIds.size === 0) {
      toast({ title: "학생을 먼저 선택해주세요", description: "문자를 보낼 학생을 한 명 이상 선택해주세요.", variant: "destructive" });
      return;
    }
    if (phoneTypes.size === 0) {
      toast({ title: "수신 대상을 선택해주세요", description: "어머니, 아버지, 학생 중 최소 한 명을 선택해주세요.", variant: "destructive" });
      return;
    }
    sendBulkSmsMutation.mutate({
      studentIds: Array.from(selectedStudentIds),
      message: template.message,
      phoneTypes: Array.from(phoneTypes),
      actorId: user?.id || "",
    });
  };

  const handleApplyTemplate = (template: SmsTemplate) => {
    setMessage(template.message);
  };

  const getStudentName = (studentId: string) => {
    const student = users.find(u => u.id === studentId);
    return student?.name || "알 수 없음";
  };

  const isLoading = !classes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">문자 전송</h1>
        <ManualButton menuKey="contact-parents" />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="send" data-testid="tab-send">
            <Send className="w-4 h-4 mr-2" />
            문자 보내기
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <CalendarClock className="w-4 h-4 mr-2" />
            예약 문자
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-2" />
            발송 내역
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Settings className="w-4 h-4 mr-2" />
            설정
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <div className="space-y-4">
            {isAdminOrPrincipal && teachers && teachers.length > 0 && (
              <div className="space-y-3">
                <Tabs value={selectedTeacher} onValueChange={(v) => {
                  setSelectedTeacher(v);
                  setSelectedClass("all");
                  setSelectedStudentIds(new Set());
                }}>
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="" data-testid="teacher-tab-all">
                      모든 선생님
                    </TabsTrigger>
                    {teachers.map((t: any) => (
                      <TabsTrigger key={t.id} value={t.id} data-testid={`teacher-tab-${t.id}`}>
                        {t.name} 선생님
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {teacherClasses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">수업:</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedClass === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedClass("all");
                        }}
                        data-testid="class-filter-all"
                      >
                        전체
                      </Button>
                      {teacherClasses.map((c) => (
                        <Button
                          key={c.id}
                          variant={selectedClass === c.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedClass(c.id);
                          }}
                          data-testid={`class-filter-${c.id}`}
                        >
                          {c.name}{c.subject ? ` ${c.subject}반` : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isTeacherOnly && (
              <TeacherClassTabs
                teacherViewTab={teacherViewTab}
                onTabChange={(tab) => {
                  setTeacherViewTab(tab);
                  setSelectedClass("all");
                  setSelectedStudentIds(new Set());
                }}
                ownCount={ownClasses.length}
                assistantCount={assistantClasses.length}
              />
            )}

            {isTeacherOnly && displayClasses.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">수업:</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedClass === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedClass("all");
                    }}
                    data-testid="teacher-class-filter-all"
                  >
                    전체
                  </Button>
                  {displayClasses.map((c) => (
                    <Button
                      key={c.id}
                      variant={selectedClass === c.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedClass(c.id);
                      }}
                      data-testid={`teacher-class-filter-${c.id}`}
                    >
                      {c.name}{c.subject ? ` ${c.subject}반` : ""}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">학년:</span>
              <div className="flex flex-wrap gap-1">
                {gradeOptions.map((grade) => (
                  <Button
                    key={grade.value}
                    variant={selectedGrade === grade.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedGrade(grade.value);
                    }}
                    data-testid={`grade-filter-${grade.value}`}
                  >
                    {grade.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Users className="w-5 h-5" />
                        학생 목록
                        <Badge variant="secondary">{filteredStudents.length}명</Badge>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        data-testid="button-select-all"
                      >
                        {allFilteredSelected ? (
                          <>
                            <CheckSquare className="w-4 h-4 mr-2" />
                            전체 해제
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 mr-2" />
                            전체 선택
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="학생 이름 또는 전화번호로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-student-search"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isDataLoading ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-muted-foreground">학생 목록을 불러오는 중...</p>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {selectedClass !== "all" 
                          ? "해당 수업에 학부모 연락처가 등록된 학생이 없습니다." 
                          : selectedGrade !== "all"
                            ? `${selectedGrade} 학년에 학부모 연락처가 등록된 학생이 없습니다.`
                            : "학부모 연락처가 등록된 학생이 없습니다."}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredStudents.map((student: any) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                            onClick={() => handleSelectStudent(student.id)}
                            data-testid={`student-row-${student.id}`}
                          >
                            <Checkbox
                              checked={selectedStudentIds.has(student.id)}
                              onCheckedChange={() => handleSelectStudent(student.id)}
                              data-testid={`checkbox-${student.id}`}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{student.name}</div>
                              <div className="text-sm text-muted-foreground flex gap-4">
                                {student.motherPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    모: {student.motherPhone}
                                  </span>
                                )}
                                {student.fatherPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    부: {student.fatherPhone}
                                  </span>
                                )}
                                {getOwnPhone(student) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    본인: {getOwnPhone(student)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {student.grade && (
                              <Badge variant="outline">{student.grade}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {smsTemplatesData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5" />
                        빠른 전송
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {smsTemplatesData.map((template) => (
                          <div key={template.id} className="flex items-center gap-2" data-testid={`quick-template-${template.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 justify-start text-left h-auto py-2"
                              onClick={() => handleApplyTemplate(template)}
                              data-testid={`apply-template-${template.id}`}
                            >
                              <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
                              <span className="truncate">{template.title}</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleQuickSendTemplate(template)}
                              disabled={sendBulkSmsMutation.isPending || selectedStudentIds.size === 0}
                              data-testid={`quick-send-${template.id}`}
                            >
                              {sendBulkSmsMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        제목 클릭: 메시지란에 적용 | 전송 버튼: 즉시 발송
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">메시지 작성</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">수신 대상</label>
                      <div className="flex gap-2">
                        <Button
                          variant={phoneTypes.has("mother") ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePhoneType("mother")}
                          data-testid="phone-type-mother"
                        >
                          어머니
                        </Button>
                        <Button
                          variant={phoneTypes.has("father") ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePhoneType("father")}
                          data-testid="phone-type-father"
                        >
                          아버지
                        </Button>
                        <Button
                          variant={phoneTypes.has("student") ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePhoneType("student")}
                          data-testid="phone-type-student"
                        >
                          학생
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        여러 대상을 함께 선택할 수 있습니다.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">메시지 내용</label>
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="학부모님께 보낼 메시지를 입력하세요..."
                        className="min-h-32"
                        data-testid="input-message"
                      />
                      <div className="text-xs text-right space-y-0.5">
                        <span className="text-muted-foreground">{message.length}자 ({new Blob([message]).size}바이트)</span>
                        {new Blob([message]).size > 90 && new Blob([message]).size <= 2000 && (
                          <span className="text-blue-500 ml-2">LMS</span>
                        )}
                        {new Blob([message]).size > 2000 && (
                          <div className="text-destructive">2000바이트 초과 - 발송 시 내용이 자동으로 잘립니다</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">
                          선택된 학생: {selectedStudentIds.size}명
                        </label>
                        {selectedStudentIds.size > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs"
                            onClick={() => setSelectedStudentIds(new Set())}
                            data-testid="button-clear-selected"
                          >
                            전체 해제
                          </Button>
                        )}
                      </div>
                      {selectedStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          왼쪽 목록에서 학생을 선택하세요.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2" data-testid="list-selected-students">
                          {selectedStudents.map((student: any) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover-elevate"
                              data-testid={`selected-student-${student.id}`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="font-medium truncate">{student.name}</span>
                                {student.grade && (
                                  <Badge variant="outline" className="shrink-0">{student.grade}</Badge>
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleSelectStudent(student.id)}
                                data-testid={`remove-selected-${student.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <CalendarClock className="w-4 h-4" />
                          예약 전송
                        </label>
                        <Button
                          variant={isScheduled ? "default" : "outline"}
                          size="sm"
                          onClick={() => setIsScheduled(prev => !prev)}
                          data-testid="button-toggle-schedule"
                        >
                          {isScheduled ? "예약 사용 중" : "즉시 발송"}
                        </Button>
                      </div>
                      {isScheduled && (
                        <div className="space-y-1">
                          <Input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            data-testid="input-scheduled-at"
                          />
                          <p className="text-xs text-muted-foreground">
                            선택한 시간에 자동으로 발송됩니다. 예약 내역은 "예약 문자" 탭에서 확인/취소할 수 있습니다.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button
                        className="w-full"
                        onClick={handleSendMessage}
                        disabled={sendBulkSmsMutation.isPending || scheduleSmsMutation.isPending || selectedStudentIds.size === 0 || !message.trim()}
                        data-testid="button-send-message"
                      >
                        {(sendBulkSmsMutation.isPending || scheduleSmsMutation.isPending) ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isScheduled ? "예약 등록 중..." : "발송 중..."}
                          </>
                        ) : isScheduled ? (
                          <>
                            <CalendarClock className="w-4 h-4 mr-2" />
                            예약 등록
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            문자 발송
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5" />
                예약 문자
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : scheduledSmsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  예약된 문자가 없습니다.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scheduledSmsData.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg" data-testid={`scheduled-item-${item.id}`}>
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.status === "pending" ? "default" : item.status === "sent" ? "secondary" : item.status === "processing" ? "default" : "outline"}>
                            {item.status === "pending" ? "예약됨" : item.status === "processing" ? "발송 중" : item.status === "sent" ? "발송완료" : item.status === "cancelled" ? "취소됨" : "실패"}
                          </Badge>
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(item.scheduledAt), "yyyy.MM.dd HH:mm", { locale: ko })}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.studentIds.length}명
                          </span>
                          {item.status === "sent" && item.successCount != null && (
                            <span className="text-xs text-muted-foreground">
                              (성공 {item.successCount} / 실패 {item.failCount ?? 0})
                            </span>
                          )}
                        </div>
                        {item.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs text-destructive"
                            onClick={() => cancelScheduledSmsMutation.mutate(item.id)}
                            disabled={cancelScheduledSmsMutation.isPending}
                            data-testid={`button-cancel-scheduled-${item.id}`}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            취소
                          </Button>
                        )}
                      </div>
                      <div className="text-sm mt-2 bg-muted/50 p-2 rounded whitespace-pre-wrap">{item.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                발송 내역
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : smsHistoryData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  발송 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {smsHistoryData.map((history: any) => (
                    <div key={history.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={(history.status === "success" || history.status === "sent") ? "default" : "destructive"}>
                            {(history.status === "success" || history.status === "sent") ? "성공" : "실패"}
                          </Badge>
                          <span className="font-medium">{getStudentName(history.studentId)}</span>
                          <span className="text-sm text-muted-foreground">
                            ({history.recipientType === "mother" ? "어머니" : history.recipientType === "father" ? "아버지" : "본인"})
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(history.sentAt), "yyyy.MM.dd HH:mm", { locale: ko })}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">{history.recipientPhone}</div>
                      {history.status === "failed" && history.errorMessage && (
                        <div className="text-xs text-destructive mt-1">실패 사유: {history.errorMessage}</div>
                      )}
                      <div className="text-sm mt-2 bg-muted/50 p-2 rounded">{history.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  문자 템플릿 관리
                </CardTitle>
                <Button size="sm" onClick={() => handleOpenTemplateDialog()} data-testid="button-add-template">
                  <Plus className="w-4 h-4 mr-2" />
                  템플릿 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {smsTemplatesData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="mb-1">저장된 템플릿이 없습니다</p>
                  <p className="text-sm">자주 사용하는 문구를 템플릿으로 저장해두면</p>
                  <p className="text-sm">문자 보내기 탭에서 원클릭으로 전송할 수 있습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {smsTemplatesData.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg" data-testid={`template-item-${template.id}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold">{template.title}</h3>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenTemplateDialog(template)}
                            data-testid={`edit-template-${template.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("이 템플릿을 삭제하시겠습니까?")) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                            data-testid={`delete-template-${template.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap">{template.message}</div>
                      {template.createdAt && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {format(new Date(template.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })} 생성
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "템플릿 수정" : "새 템플릿 추가"}</DialogTitle>
            <DialogDescription>
              자주 사용하는 문자 내용을 미리 저장해두세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="예: 수업 결석 안내, 시험 안내 등"
                data-testid="input-template-title"
              />
            </div>
            <div className="space-y-2">
              <Label>메시지 내용</Label>
              <Textarea
                value={templateMessage}
                onChange={(e) => setTemplateMessage(e.target.value)}
                placeholder="학부모님께 보낼 메시지를 입력하세요..."
                className="min-h-32"
                data-testid="input-template-message"
              />
              <div className="text-xs text-right space-y-0.5">
                <span className="text-muted-foreground">{templateMessage.length}자 ({new Blob([templateMessage]).size}바이트)</span>
                {new Blob([templateMessage]).size > 90 && new Blob([templateMessage]).size <= 2000 && (
                  <span className="text-blue-500 ml-2">LMS</span>
                )}
                {new Blob([templateMessage]).size > 2000 && (
                  <div className="text-destructive">2000바이트 초과 - 발송 시 내용이 자동으로 잘립니다</div>
                )}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending || !templateTitle.trim() || !templateMessage.trim()}
              data-testid="button-save-template"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                editingTemplate ? "수정" : "저장"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
