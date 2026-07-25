import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Play, Video, ExternalLink, Trash2, Pencil, Users, UserCheck } from "lucide-react";
import { ManualButton } from "@/components/manual-button";
import { TeacherClassTabs } from "@/components/teacher-class-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, isAssistantTeacher, type Class, type ClassVideo, type User } from "@shared/schema";

function getYoutubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&]+)/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&]+)/);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return "";
}

function getYoutubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^?&]+)/);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
}

function StudentSelector({ classId, selectedStudentIds, onSelectionChange }: {
  classId: string;
  selectedStudentIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const { data: students = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/classes/${classId}/students`],
    enabled: !!classId,
  });

  if (!classId) return null;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-2">학생 목록 불러오는 중...</div>;
  }

  if (students.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">수강 중인 학생이 없습니다</div>;
  }

  const allSelected = students.length > 0 && students.every(s => selectedStudentIds.includes(s.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">학생 선택 ({selectedStudentIds.length}/{students.length}명)</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            if (allSelected) {
              onSelectionChange([]);
            } else {
              onSelectionChange(students.map((s: any) => s.id));
            }
          }}
          data-testid="button-toggle-all-students"
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </Button>
      </div>
      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
        {[...students].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", "ko")).map((student: any) => (
          <label
            key={student.id}
            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={selectedStudentIds.includes(student.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectionChange([...selectedStudentIds, student.id]);
                } else {
                  onSelectionChange(selectedStudentIds.filter(id => id !== student.id));
                }
              }}
              data-testid={`checkbox-student-${student.id}`}
            />
            <span className="text-sm">{student.name}</span>
            {student.grade && <Badge variant="outline" className="text-xs">{student.grade}</Badge>}
          </label>
        ))}
      </div>
    </div>
  );
}

function VideoCard({ video, onDelete, onEdit, canDelete }: { 
  video: ClassVideo; 
  onDelete?: () => void;
  onEdit?: () => void;
  canDelete: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnail = getYoutubeThumbnail(video.youtubeUrl);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {isPlaying ? (
          <iframe
            src={getYoutubeEmbedUrl(video.youtubeUrl) + "?autoplay=1"}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={video.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
              data-testid={`button-play-${video.id}`}
            >
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="h-8 w-8 text-foreground ml-1" />
              </div>
            </button>
          </>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium truncate" data-testid={`video-title-${video.id}`}>
              {video.title}
            </h4>
            {canDelete && !video.isAllStudents && video.visibleTo && video.visibleTo.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <UserCheck className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{video.visibleTo.length}명 공개</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
            >
              <a
                href={video.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-youtube-${video.id}`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            {canDelete && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                data-testid={`button-edit-${video.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                data-testid={`button-delete-${video.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddVideoDialog({ classes, onClose, defaultClassId }: { classes: Class[]; onClose: () => void; defaultClassId?: string }) {
  const { toast } = useToast();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(defaultClassId ? [defaultClassId] : []);
  const [formData, setFormData] = useState({
    title: "",
    youtubeUrl: "",
  });
  const [visibilityMode, setVisibilityMode] = useState<"all" | "selected">("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const thumbnail = getYoutubeThumbnail(formData.youtubeUrl);
  const singleClassId = selectedClassIds.length === 1 ? selectedClassIds[0] : "";

  useEffect(() => {
    setSelectedStudentIds([]);
    if (selectedClassIds.length !== 1) {
      setVisibilityMode("all");
    }
  }, [selectedClassIds.join(",")]);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; youtubeUrl: string }) => {
      const classIds = Array.from(new Set(selectedClassIds));
      const useSelectedStudents = classIds.length === 1 && visibilityMode === "selected";
      const results = await Promise.allSettled(
        classIds.map((classId) =>
          apiRequest("POST", "/api/class-videos", {
            classId,
            title: data.title,
            youtubeUrl: data.youtubeUrl,
            thumbnailUrl: getYoutubeThumbnail(data.youtubeUrl),
            isAllStudents: !useSelectedStudents,
            visibleTo: useSelectedStudents ? selectedStudentIds : null,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: classIds.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      invalidateQueriesStartingWith("/api/class-videos");
      if (failed === 0) {
        toast({ title: total > 1 ? `${total}개 수업에 영상이 등록되었습니다` : "영상이 등록되었습니다" });
        onClose();
      } else if (failed < total) {
        toast({
          title: `${total - failed}개 수업에 등록, ${failed}개 수업은 실패했습니다`,
          variant: "destructive",
        });
        onClose();
      } else {
        toast({ title: "영상 등록에 실패했습니다", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "영상 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClassIds.length === 0) {
      toast({ title: "수업을 1개 이상 선택해주세요", variant: "destructive" });
      return;
    }
    if (visibilityMode === "selected" && selectedStudentIds.length === 0) {
      toast({ title: "공개할 학생을 1명 이상 선택해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const allClassesSelected = classes.length > 0 && selectedClassIds.length === classes.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수업 선택 ({selectedClassIds.length}/{classes.length}개)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedClassIds(allClassesSelected ? [] : classes.map((c) => c.id))}
            data-testid="button-toggle-all-classes"
          >
            {allClassesSelected ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
          {classes.map((cls) => (
            <label
              key={cls.id}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selectedClassIds.includes(cls.id)}
                onCheckedChange={(checked) => {
                  setSelectedClassIds((prev) =>
                    checked
                      ? prev.includes(cls.id) ? prev : [...prev, cls.id]
                      : prev.filter((id) => id !== cls.id)
                  );
                }}
                data-testid={`checkbox-video-class-${cls.id}`}
              />
              <span className="text-sm">{cls.name} {cls.subject}반</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">영상 제목</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 1주차 수업 영상"
          required
          data-testid="input-video-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="youtubeUrl">유튜브 링크</Label>
        <Input
          id="youtubeUrl"
          value={formData.youtubeUrl}
          onChange={(e) => setFormData((p) => ({ ...p, youtubeUrl: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=..."
          required
          data-testid="input-youtube-url"
        />
      </div>

      {thumbnail && (
        <div className="space-y-2">
          <Label>미리보기</Label>
          <div className="aspect-video rounded-md overflow-hidden bg-muted">
            <img src={thumbnail} alt="미리보기" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {selectedClassIds.length > 0 && (
        <div className="space-y-3 border rounded-lg p-3">
          <Label>공개 대상</Label>
          {selectedClassIds.length > 1 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              수업을 여러 개 선택한 경우 모든 수강생에게 공개됩니다
            </p>
          ) : (
            <>
              <RadioGroup
                value={visibilityMode}
                onValueChange={(v) => setVisibilityMode(v as "all" | "selected")}
                className="space-y-2"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="all" data-testid="radio-all-students" />
                  <Users className="h-4 w-4" />
                  <span className="text-sm">모든 수강생에게 공개</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="selected" data-testid="radio-selected-students" />
                  <UserCheck className="h-4 w-4" />
                  <span className="text-sm">특정 학생만 공개</span>
                </label>
              </RadioGroup>

              {visibilityMode === "selected" && (
                <StudentSelector
                  classId={singleClassId}
                  selectedStudentIds={selectedStudentIds}
                  onSelectionChange={setSelectedStudentIds}
                />
              )}
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-add-video">
          {createMutation.isPending ? "등록 중..." : "영상 등록"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditVideoDialog({ video, classes, videos, onClose }: { video: ClassVideo; classes: Class[]; videos?: ClassVideo[]; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([video.classId]);
  const [formData, setFormData] = useState({
    title: video.title,
    youtubeUrl: video.youtubeUrl,
  });
  const [visibilityMode, setVisibilityMode] = useState<"all" | "selected">(
    video.isAllStudents ? "all" : "selected"
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    video.visibleTo || []
  );

  const thumbnail = getYoutubeThumbnail(formData.youtubeUrl);
  const singleClassId = selectedClassIds.length === 1 ? selectedClassIds[0] : "";

  useEffect(() => {
    if (selectedClassIds.length !== 1) {
      setVisibilityMode("all");
      setSelectedStudentIds([]);
    } else if (selectedClassIds[0] !== video.classId) {
      setVisibilityMode("all");
      setSelectedStudentIds([]);
    } else {
      setVisibilityMode(video.isAllStudents ? "all" : "selected");
      setSelectedStudentIds(video.visibleTo || []);
    }
  }, [selectedClassIds.join(",")]);

  const updateMutation = useMutation({
    mutationFn: async (data: { title: string; youtubeUrl: string }) => {
      const classIds = Array.from(new Set(selectedClassIds));
      const useSelectedStudents = classIds.length === 1 && visibilityMode === "selected";
      const keepOriginal = classIds.includes(video.classId);
      const patchClassId = keepOriginal ? video.classId : classIds[0];
      const extraClassIds = classIds.filter((id) => id !== patchClassId);

      const payloadBase = {
        title: data.title,
        youtubeUrl: data.youtubeUrl,
        thumbnailUrl: getYoutubeThumbnail(data.youtubeUrl),
        isAllStudents: !useSelectedStudents,
        visibleTo: useSelectedStudents ? selectedStudentIds : null,
      };

      const patchResult = await Promise.allSettled([
        apiRequest("PATCH", `/api/class-videos/${video.id}`, {
          ...payloadBase,
          classId: patchClassId,
        }),
      ]);

      const videoId = getYoutubeVideoId(data.youtubeUrl);
      const newClassIds = extraClassIds.filter(
        (classId) =>
          !videos?.some(
            (v) =>
              v.id !== video.id &&
              v.classId === classId &&
              (v.youtubeUrl === data.youtubeUrl ||
                (videoId !== null && getYoutubeVideoId(v.youtubeUrl) === videoId))
          )
      );

      const postResults = await Promise.allSettled(
        newClassIds.map((classId) =>
          apiRequest("POST", "/api/class-videos", {
            ...payloadBase,
            classId,
          })
        )
      );

      const results = [...patchResult, ...postResults];
      const failed = results.filter((r) => r.status === "rejected").length;
      const skipped = extraClassIds.length - newClassIds.length;
      return { total: results.length, failed, skipped };
    },
    onSuccess: ({ total, failed, skipped }) => {
      invalidateQueriesStartingWith("/api/class-videos");
      if (failed === 0) {
        toast({
          title:
            total > 1
              ? `영상이 수정되고 ${total - 1}개 수업에 추가 등록되었습니다${skipped > 0 ? ` (${skipped}개 수업은 이미 등록되어 있어 건너뜀)` : ""}`
              : `영상이 수정되었습니다${skipped > 0 ? ` (${skipped}개 수업은 이미 등록되어 있어 건너뜀)` : ""}`,
        });
        onClose();
      } else if (failed < total) {
        toast({
          title: `일부 저장에 실패했습니다 (${total - failed}개 성공, ${failed}개 실패)`,
          variant: "destructive",
        });
        onClose();
      } else {
        toast({ title: "영상 수정에 실패했습니다", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "영상 수정에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClassIds.length === 0) {
      toast({ title: "수업을 1개 이상 선택해주세요", variant: "destructive" });
      return;
    }
    if (selectedClassIds.length === 1 && visibilityMode === "selected" && selectedStudentIds.length === 0) {
      toast({ title: "공개할 학생을 1명 이상 선택해주세요", variant: "destructive" });
      return;
    }
    updateMutation.mutate(formData);
  };

  const allClassesSelected = classes.length > 0 && selectedClassIds.length === classes.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>수업 선택 ({selectedClassIds.length}/{classes.length}개)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedClassIds(allClassesSelected ? [] : classes.map((c) => c.id))}
            data-testid="button-toggle-all-classes-edit"
          >
            {allClassesSelected ? "전체 해제" : "전체 선택"}
          </Button>
        </div>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
          {classes.map((cls) => (
            <label
              key={cls.id}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selectedClassIds.includes(cls.id)}
                onCheckedChange={(checked) => {
                  setSelectedClassIds((prev) =>
                    checked
                      ? prev.includes(cls.id) ? prev : [...prev, cls.id]
                      : prev.filter((id) => id !== cls.id)
                  );
                }}
                data-testid={`checkbox-edit-video-class-${cls.id}`}
              />
              <span className="text-sm">{cls.name} {cls.subject}반</span>
            </label>
          ))}
        </div>
        {selectedClassIds.length > 1 && (
          <p className="text-xs text-muted-foreground">
            추가로 선택한 수업에는 같은 영상이 새로 등록됩니다
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-title">영상 제목</Label>
        <Input
          id="edit-title"
          value={formData.title}
          onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
          placeholder="예: 1주차 수업 영상"
          required
          data-testid="input-edit-video-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-youtubeUrl">유튜브 링크</Label>
        <Input
          id="edit-youtubeUrl"
          value={formData.youtubeUrl}
          onChange={(e) => setFormData((p) => ({ ...p, youtubeUrl: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=..."
          required
          data-testid="input-edit-youtube-url"
        />
      </div>

      {thumbnail && (
        <div className="space-y-2">
          <Label>미리보기</Label>
          <div className="aspect-video rounded-md overflow-hidden bg-muted">
            <img src={thumbnail} alt="미리보기" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {selectedClassIds.length > 0 && (
        <div className="space-y-3 border rounded-lg p-3">
          <Label>공개 대상</Label>
          {selectedClassIds.length > 1 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              수업을 여러 개 선택한 경우 모든 수강생에게 공개됩니다
            </p>
          ) : (
            <>
              <RadioGroup
                value={visibilityMode}
                onValueChange={(v) => setVisibilityMode(v as "all" | "selected")}
                className="space-y-2"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="all" data-testid="radio-edit-all-students" />
                  <Users className="h-4 w-4" />
                  <span className="text-sm">모든 수강생에게 공개</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="selected" data-testid="radio-edit-selected-students" />
                  <UserCheck className="h-4 w-4" />
                  <span className="text-sm">특정 학생만 공개</span>
                </label>
              </RadioGroup>

              {visibilityMode === "selected" && singleClassId && (
                <StudentSelector
                  classId={singleClassId}
                  selectedStudentIds={selectedStudentIds}
                  onSelectionChange={setSelectedStudentIds}
                />
              )}
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-video">
          {updateMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function VideosPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<ClassVideo | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [teacherViewTab, setTeacherViewTab] = useState<"my" | "assistant">("my");

  const isTeacherOrAbove = user && user.role >= UserRole.TEACHER;
  const isAdminOrPrincipal = user && user.role >= UserRole.PRINCIPAL;

  const { data: teachers } = useQuery<User[]>({
    queryKey: [`/api/centers/${selectedCenter?.id}/teachers`],
    enabled: !!selectedCenter?.id && !!isAdminOrPrincipal,
  });

  const { data: classes, isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  const { data: videos, isLoading: loadingVideos } = useQuery<ClassVideo[]>({
    queryKey: [`/api/class-videos?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  const { data: enrolledClasses } = useQuery<any[]>({
    queryKey: [`/api/students/${user?.id}/enrollments`],
    enabled: !!user?.id && !isTeacherOrAbove,
  });

  if (isAdminOrPrincipal && teachers && teachers.length > 0 && !selectedTeacher) {
    setSelectedTeacher(teachers[0].id);
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/class-videos/${id}`);
    },
    onSuccess: () => {
      invalidateQueriesStartingWith("/api/class-videos");
      toast({ title: "영상이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const isTeacherOnly = user && user.role === UserRole.TEACHER;
  const teacherClasses = classes?.filter((c) => {
    if (isTeacherOnly) return c.teacherId === user.id || isAssistantTeacher(c, user.id);
    if (!isAdminOrPrincipal) return true;
    if (!selectedTeacher) return true;
    return c.teacherId === selectedTeacher || isAssistantTeacher(c, selectedTeacher);
  }) ?? [];

  const ownClasses = isTeacherOnly
    ? teacherClasses.filter((c) => c.teacherId === user.id)
    : teacherClasses;
  const assistantClasses = isTeacherOnly
    ? teacherClasses.filter((c) => isAssistantTeacher(c, user.id) && c.teacherId !== user.id)
    : [];
  const hasAssistantClasses = assistantClasses.length > 0;
  const displayClasses = isTeacherOnly && hasAssistantClasses
    ? (teacherViewTab === "assistant" ? assistantClasses : ownClasses)
    : teacherClasses;

  const accessibleVideos = videos?.filter((video) => {
    if (isTeacherOrAbove) {
      const videoClass = classes?.find((c) => c.id === video.classId);
      if (!videoClass) return false;
      if (isTeacherOnly && videoClass.teacherId !== user.id && !isAssistantTeacher(videoClass, user.id)) return false;
      if (isAdminOrPrincipal && selectedTeacher && videoClass.teacherId !== selectedTeacher && !isAssistantTeacher(videoClass, selectedTeacher)) return false;
      return true;
    }
    const isEnrolled = enrolledClasses?.some((e) => e.classId === video.classId);
    if (!isEnrolled) return false;
    if (video.isAllStudents) return true;
    if (video.visibleTo && video.visibleTo.includes(user!.id)) return true;
    return false;
  }) ?? [];

  const filteredVideos = selectedClassId === "all"
    ? accessibleVideos
    : accessibleVideos.filter((v) => v.classId === selectedClassId);

  const visibleClasses = isTeacherOrAbove
    ? displayClasses
    : classes?.filter((c) => enrolledClasses?.some((e) => e.classId === c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">수업 영상</h1>
            <p className="text-muted-foreground">
              {isTeacherOrAbove ? "수업 영상 관리" : "수업 영상 시청"}
            </p>
          </div>
          <ManualButton menuKey="videos" />
        </div>
        {isTeacherOrAbove && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-video-dialog">
                <Plus className="h-4 w-4 mr-2" />
                영상 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>영상 등록</DialogTitle>
                <DialogDescription>유튜브 링크를 등록하세요</DialogDescription>
              </DialogHeader>
              <AddVideoDialog
                classes={displayClasses.length > 0 ? displayClasses : (classes ?? [])}
                defaultClassId={selectedClassId !== "all" ? selectedClassId : undefined}
                onClose={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdminOrPrincipal && teachers && teachers.length > 0 && (
        <div className="space-y-3">
          <Tabs value={selectedTeacher} onValueChange={(v) => {
            setSelectedTeacher(v);
            setSelectedClassId("all");
          }}>
            <TabsList className="flex-wrap h-auto gap-1">
              {teachers.map((t) => (
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
                  variant={selectedClassId === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedClassId("all")}
                  data-testid="class-filter-all"
                >
                  전체
                </Button>
                {teacherClasses.map((c) => (
                  <Button
                    key={c.id}
                    variant={selectedClassId === c.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedClassId(c.id)}
                    data-testid={`class-filter-${c.id}`}
                  >
                    {c.name} {c.subject}반
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
            setSelectedClassId("all");
          }}
          ownCount={ownClasses.length}
          assistantCount={assistantClasses.length}
        />
      )}

      {!isAdminOrPrincipal && visibleClasses && visibleClasses.length > 1 && (
        <Tabs value={selectedClassId} onValueChange={setSelectedClassId}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">전체</TabsTrigger>
            {visibleClasses.map((cls) => (
              <TabsTrigger key={cls.id} value={cls.id}>
                {cls.name} {cls.subject}반
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {loadingVideos ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="aspect-video" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>등록된 영상이 없습니다</p>
            {!isTeacherOrAbove && (
              <p className="text-sm mt-1">신청한 수업의 영상만 시청할 수 있습니다</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              canDelete={isTeacherOrAbove || false}
              onEdit={() => setEditingVideo(video)}
              onDelete={() => deleteMutation.mutate(video.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>영상 수정</DialogTitle>
            <DialogDescription>영상 정보를 수정하세요</DialogDescription>
          </DialogHeader>
          {editingVideo && (
            <EditVideoDialog
              video={editingVideo}
              classes={displayClasses.length > 0 ? displayClasses : (classes ?? [])}
              videos={videos}
              onClose={() => setEditingVideo(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
