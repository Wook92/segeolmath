import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ManualButton } from "@/components/manual-button";
import { Plus, Play, Video, ExternalLink, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateQueriesStartingWith } from "@/lib/queryClient";
import { UserRole, type Class, type User, type StudentPresentationVideo } from "@shared/schema";

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

function VideoCard({ 
  video, 
  studentName,
  onDelete, 
  onEdit, 
  canManage 
}: { 
  video: StudentPresentationVideo; 
  studentName?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  canManage: boolean;
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
          <div className="min-w-0 flex-1">
            <h4 className="font-medium truncate" data-testid={`video-title-${video.id}`}>
              {video.title}
            </h4>
            {studentName && (
              <p className="text-sm text-muted-foreground truncate">{studentName}</p>
            )}
            {video.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
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
            {canManage && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                data-testid={`button-edit-${video.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canManage && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
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

export default function PresentationVideosPage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<StudentPresentationVideo | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    youtubeUrl: "",
    description: "",
  });

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.PRINCIPAL || user?.role === UserRole.TEACHER;
  const isStudent = user?.role === UserRole.STUDENT;

  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: [`/api/classes?centerId=${selectedCenter?.id}`],
    enabled: !!selectedCenter?.id,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery<User[]>({
    queryKey: ["/api/classes", selectedClassId, "students"],
    enabled: !!selectedClassId && canManage,
  });

  const videosQueryKey = isStudent
    ? [`/api/student-presentation-videos?centerId=${selectedCenter?.id}&studentId=${user?.id}`]
    : selectedStudentId
    ? [`/api/student-presentation-videos?centerId=${selectedCenter?.id}&classId=${selectedClassId}&studentId=${selectedStudentId}`]
    : selectedClassId
    ? [`/api/student-presentation-videos?centerId=${selectedCenter?.id}&classId=${selectedClassId}`]
    : [`/api/student-presentation-videos?centerId=${selectedCenter?.id}`];

  const { data: videos = [], isLoading: videosLoading } = useQuery<StudentPresentationVideo[]>({
    queryKey: videosQueryKey,
    enabled: !!selectedCenter?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { studentId: string; classId: string; title: string; youtubeUrl: string; description?: string }) => {
      return apiRequest("POST", `/api/student-presentation-videos?actorId=${user?.id}`, {
        ...data,
        centerId: selectedCenter?.id,
      });
    },
    onSuccess: () => {
      toast({ title: "발표영상이 등록되었습니다" });
      setIsAddDialogOpen(false);
      setFormData({ title: "", youtubeUrl: "", description: "" });
      invalidateQueriesStartingWith("/api/student-presentation-videos");
    },
    onError: () => {
      toast({ title: "등록에 실패했습니다", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; youtubeUrl: string; description?: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/student-presentation-videos/${id}?actorId=${user?.id}`, rest);
    },
    onSuccess: () => {
      toast({ title: "발표영상이 수정되었습니다" });
      setEditingVideo(null);
      setFormData({ title: "", youtubeUrl: "", description: "" });
      invalidateQueriesStartingWith("/api/student-presentation-videos");
    },
    onError: () => {
      toast({ title: "수정에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/student-presentation-videos/${id}?actorId=${user?.id}`);
    },
    onSuccess: () => {
      toast({ title: "발표영상이 삭제되었습니다" });
      setDeleteConfirmId(null);
      invalidateQueriesStartingWith("/api/student-presentation-videos");
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.youtubeUrl) {
      toast({ title: "제목과 유튜브 링크를 입력해주세요", variant: "destructive" });
      return;
    }

    if (editingVideo) {
      updateMutation.mutate({
        id: editingVideo.id,
        title: formData.title,
        youtubeUrl: formData.youtubeUrl,
        description: formData.description,
      });
    } else {
      if (!selectedClassId || !selectedStudentId) {
        toast({ title: "반과 학생을 선택해주세요", variant: "destructive" });
        return;
      }
      createMutation.mutate({
        studentId: selectedStudentId,
        classId: selectedClassId,
        title: formData.title,
        youtubeUrl: formData.youtubeUrl,
        description: formData.description,
      });
    }
  };

  const openEditDialog = (video: StudentPresentationVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      youtubeUrl: video.youtubeUrl,
      description: video.description || "",
    });
  };

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    return student?.name || "알 수 없음";
  };

  const getClassName = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    return cls?.name || "알 수 없음";
  };

  if (classesLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">발표영상</h1>
          <ManualButton menuKey="presentation-videos" />
        </div>
        {canManage && (
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-video">
            <Plus className="h-4 w-4 mr-2" />
            영상 등록
          </Button>
        )}
      </div>

      {canManage && (
        <div className="flex gap-4 mb-6 flex-wrap">
          <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedStudentId(""); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-class">
              <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 반</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClassId && selectedClassId !== "all" && (
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-[200px]" data-testid="select-student">
                <SelectValue placeholder="학생 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학생</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {isStudent && (
        <p className="text-muted-foreground mb-4">나에게 등록된 발표영상입니다.</p>
      )}

      {videosLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>등록된 발표영상이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              studentName={canManage ? getStudentName(video.studentId) : undefined}
              canManage={canManage}
              onEdit={() => openEditDialog(video)}
              onDelete={() => setDeleteConfirmId(video.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발표영상 등록</DialogTitle>
            <DialogDescription>학생의 발표영상 링크를 등록합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>반 선택</Label>
              <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedStudentId(""); }}>
                <SelectTrigger data-testid="dialog-select-class">
                  <SelectValue placeholder="반 선택" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClassId && (
              <div>
                <Label>학생 선택</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger data-testid="dialog-select-student">
                    <SelectValue placeholder="학생 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>제목</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="발표 영상 제목"
                data-testid="input-title"
              />
            </div>
            <div>
              <Label>유튜브 링크</Label>
              <Input
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                data-testid="input-youtube-url"
              />
            </div>
            <div>
              <Label>설명 (선택)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="영상에 대한 설명"
                data-testid="input-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발표영상 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="발표 영상 제목"
                data-testid="input-edit-title"
              />
            </div>
            <div>
              <Label>유튜브 링크</Label>
              <Input
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                data-testid="input-edit-youtube-url"
              />
            </div>
            <div>
              <Label>설명 (선택)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="영상에 대한 설명"
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVideo(null)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              data-testid="button-update"
            >
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>발표영상 삭제</DialogTitle>
            <DialogDescription>정말 이 발표영상을 삭제하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
