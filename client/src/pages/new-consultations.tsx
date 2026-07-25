import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserRole, type NewConsultation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Pencil, Trash2, ClipboardList, User as UserIcon, GraduationCap, Maximize2, Minimize2, CalendarCheck } from "lucide-react";

const toProxyUrl = (url: string): string => {
  if (!url) return url;
  if (url.includes(".r2.cloudflarestorage.com/")) {
    const parts = url.split(".r2.cloudflarestorage.com/");
    if (parts.length === 2) return `/api/r2-proxy/${parts[1]}`;
  }
  if (url.startsWith("https://pub-") && url.includes(".r2.dev/")) {
    const parts = url.split(".r2.dev/");
    if (parts.length === 2) return `/api/r2-proxy/${parts[1]}`;
  }
  return url;
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const defaultSidebarLogoUrl = "/default-sidebar-logo.png";

type FormState = {
  studentName: string;
  gender: string;
  school: string;
  grade: string;
  targetSchool: string;
  studentPhone: string;
  parentPhone: string;
  availableDays: string[];
  scores: string;
  counselingContent: string;
};

const emptyForm: FormState = {
  studentName: "",
  gender: "",
  school: "",
  grade: "",
  targetSchool: "",
  studentPhone: "",
  parentPhone: "",
  availableDays: [],
  scores: "",
  counselingContent: "",
};

export default function NewConsultationsPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const centerId = selectedCenter?.id || "";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next) {
        await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // 브라우저가 전체화면을 지원하지 않는 경우 무시
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setIsFullscreen(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const isStaff = !!user && user.role >= UserRole.TEACHER && !user.isClinicTeacher;

  const { data: consultations = [], isLoading } = useQuery<NewConsultation[]>({
    queryKey: ["/api/new-consultations", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/new-consultations?centerId=${centerId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!centerId && isStaff,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/new-consultations", centerId] });

  const serializeForm = (data: FormState) => ({
    ...data,
    availableDays: data.availableDays.length > 0 ? data.availableDays.join(",") : "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormState) =>
      apiRequest("POST", "/api/new-consultations", { ...serializeForm(data), centerId, createdBy: user?.id, consultationDate: format(new Date(), "yyyy-MM-dd") }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "신규상담이 등록되었습니다" });
    },
    onError: () => toast({ title: "등록에 실패했습니다", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormState }) =>
      apiRequest("PATCH", `/api/new-consultations/${id}`, serializeForm(data)),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "신규상담이 수정되었습니다" });
    },
    onError: () => toast({ title: "수정에 실패했습니다", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/new-consultations/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast({ title: "신규상담이 삭제되었습니다" });
    },
    onError: () => toast({ title: "삭제에 실패했습니다", variant: "destructive" }),
  });

  if (!isStaff) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-no-permission">
        접근 권한이 없습니다.
      </div>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: NewConsultation) => {
    setEditingId(c.id);
    setForm({
      studentName: c.studentName || "",
      gender: c.gender || "",
      school: c.school || "",
      grade: c.grade || "",
      targetSchool: c.targetSchool || "",
      studentPhone: c.studentPhone || "",
      parentPhone: c.parentPhone || "",
      availableDays: c.availableDays ? c.availableDays.split(",").filter(Boolean) : [],
      scores: c.scores || "",
      counselingContent: c.counselingContent || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.studentName.trim()) {
      toast({ title: "학생 이름을 입력해주세요", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const logoUrl = selectedCenter?.logoUrl ? toProxyUrl(selectedCenter.logoUrl) : null;
  const sidebarLogoUrl = selectedCenter?.sidebarLogoUrl ? toProxyUrl(selectedCenter.sidebarLogoUrl) : null;

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
    }));
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt="센터 로고" className="h-10 w-10 rounded object-contain" data-testid="img-center-logo" />
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <ClipboardList className="h-5 w-5" />
              신규상담
            </h1>
            <p className="text-sm text-muted-foreground">{selectedCenter?.name}</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-add-consultation">
          <Plus className="h-4 w-4 mr-1" />
          신규상담 등록
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : consultations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground" data-testid="text-empty">
            등록된 신규상담이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => (
            <Card key={c.id} data-testid={`card-consultation-${c.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span data-testid={`text-student-name-${c.id}`}>{c.studentName}</span>
                    {c.gender && <span className="text-sm font-normal text-muted-foreground">({c.gender})</span>}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-2">
                      {c.consultationDate
                        ? format(new Date(c.consultationDate), "yyyy.MM.dd (EEE)", { locale: ko })
                        : c.createdAt ? format(new Date(c.createdAt), "yyyy.MM.dd (EEE)", { locale: ko }) : ""}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} data-testid={`button-edit-${c.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)} data-testid={`button-delete-${c.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                  {c.school && <div><span className="text-muted-foreground">학교:</span> {c.school}</div>}
                  {c.grade && <div><span className="text-muted-foreground">학년:</span> {c.grade}</div>}
                  {c.targetSchool && <div><span className="text-muted-foreground">목표학교:</span> {c.targetSchool}</div>}
                  {c.studentPhone && <div data-testid={`text-student-phone-${c.id}`}><span className="text-muted-foreground">학생 연락처:</span> {c.studentPhone}</div>}
                  {c.parentPhone && <div data-testid={`text-parent-phone-${c.id}`}><span className="text-muted-foreground">학부모 연락처:</span> {c.parentPhone}</div>}
                </div>
                {c.availableDays && (
                  <div className="pt-1 flex items-center gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">수업 가능 요일:</span>{" "}
                    <span data-testid={`text-available-days-${c.id}`}>{c.availableDays.split(",").join(", ")}</span>
                  </div>
                )}
                {c.scores && (
                  <div className="pt-1">
                    <span className="text-muted-foreground">성적:</span>{" "}
                    <span className="whitespace-pre-wrap">{c.scores}</span>
                  </div>
                )}
                {c.counselingContent && (
                  <div className="pt-1">
                    <span className="text-muted-foreground">상담내용:</span>{" "}
                    <span className="whitespace-pre-wrap">{c.counselingContent}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className={cn(
            "overflow-y-auto",
            isFullscreen
              ? "left-0 top-0 translate-x-0 translate-y-0 max-w-none w-screen h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-none content-start pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]"
              : "max-w-lg max-h-[90vh]"
          )}
        >
          <button
            type="button"
            className="absolute right-11 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={toggleFullscreen}
            data-testid="button-toggle-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="sr-only">전체화면 전환</span>
          </button>
          <DialogHeader className="pt-2">
            <div className="flex items-start justify-between gap-3">
              <div className="text-left space-y-1">
                <DialogTitle className="text-left">
                  {editingId ? "신규상담 수정" : "신규상담 등록"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {selectedCenter?.name} 신규상담 기록지
                </DialogDescription>
              </div>
              <img
                src={sidebarLogoUrl || logoUrl || defaultSidebarLogoUrl}
                alt="센터 로고"
                className="h-10 w-auto max-w-[120px] object-contain shrink-0 mt-6 mr-2"
                data-testid="img-dialog-logo"
              />
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                학부모 작성 영역
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>학생 이름 *</Label>
                  <Input
                    value={form.studentName}
                    onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                    placeholder="예: 홍길동"
                    data-testid="input-student-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>성별</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="남">남</SelectItem>
                      <SelectItem value="여">여</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>학교</Label>
                  <Input
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })}
                    placeholder="예: OO중학교"
                    data-testid="input-school"
                  />
                </div>
                <div className="space-y-1">
                  <Label>학년</Label>
                  <Input
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="예: 중2"
                    data-testid="input-grade"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>목표학교</Label>
                  <Input
                    value={form.targetSchool}
                    onChange={(e) => setForm({ ...form, targetSchool: e.target.value })}
                    placeholder="예: OO고등학교"
                    data-testid="input-target-school"
                  />
                </div>
                <div className="space-y-1">
                  <Label>학생 핸드폰 번호</Label>
                  <Input
                    type="tel"
                    value={form.studentPhone}
                    onChange={(e) => setForm({ ...form, studentPhone: e.target.value })}
                    placeholder="예: 01012345678"
                    data-testid="input-student-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label>학부모 핸드폰 번호</Label>
                  <Input
                    type="tel"
                    value={form.parentPhone}
                    onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                    placeholder="예: 01012345678"
                    data-testid="input-parent-phone"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>수업 가능 요일</Label>
                  <div className="flex flex-wrap gap-3">
                    {WEEKDAYS.map((day) => (
                      <label
                        key={day}
                        className="flex items-center gap-1.5 cursor-pointer text-sm"
                        data-testid={`label-day-${day}`}
                      >
                        <Checkbox
                          checked={form.availableDays.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                          data-testid={`checkbox-day-${day}`}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                선생님 작성 영역
              </div>
              <div className="space-y-1">
                <Label>성적</Label>
                <Textarea
                  value={form.scores}
                  onChange={(e) => setForm({ ...form, scores: e.target.value })}
                  placeholder="예: 수학 85점, 영어 90점"
                  rows={2}
                  data-testid="input-scores"
                />
              </div>
              <div className="space-y-1">
                <Label>상담내용</Label>
                <Textarea
                  value={form.counselingContent}
                  onChange={(e) => setForm({ ...form, counselingContent: e.target.value })}
                  placeholder="상담 내용을 입력하세요"
                  rows={4}
                  data-testid="input-counseling-content"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                취소
              </Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-submit">
                {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>신규상담 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 신규상담 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-delete-confirm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
