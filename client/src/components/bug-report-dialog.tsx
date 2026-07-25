import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserRole, BugReportStatus, type BugReport } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bug, Plus, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BugReportDialogProps {
  centerId: string;
}

export function BugReportDialog({ centerId }: BugReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: reports, isLoading } = useQuery<BugReport[]>({
    queryKey: ["/api/bug-reports/center", centerId],
    queryFn: async () => {
      const res = await fetch(`/api/bug-reports/center/${centerId}?actorId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch bug reports");
      return res.json();
    },
    enabled: !!user && !!centerId && user.role === UserRole.PRINCIPAL,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const res = await apiRequest("POST", "/api/bug-reports", {
        centerId,
        reporterId: user?.id,
        title: data.title,
        description: data.description,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports/center", centerId] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast({ title: "오류 제보가 접수되었습니다" });
    },
    onError: () => {
      toast({ title: "오류 제보에 실패했습니다", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "제목과 내용을 입력해주세요", variant: "destructive" });
      return;
    }
    createMutation.mutate({ title, description });
  };

  if (!user || user.role !== UserRole.PRINCIPAL) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          기능 오류 제보
        </CardTitle>
        <CardDescription>
          시스템 사용 중 발견한 오류를 관리자에게 제보합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2" data-testid="button-open-bug-report">
              <Plus className="h-4 w-4" />
              오류 제보하기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>기능 오류 제보</DialogTitle>
              <DialogDescription>
                발견한 오류의 제목과 자세한 내용을 입력해주세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bug-title">제목</Label>
                <Input
                  id="bug-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 출결 기록이 저장되지 않음"
                  data-testid="input-bug-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bug-description">상세 내용</Label>
                <Textarea
                  id="bug-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 상황에서 오류가 발생했는지 자세히 설명해주세요"
                  rows={5}
                  data-testid="textarea-bug-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="button-submit-bug-report"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                제보하기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">내 제보 내역</h4>
            {reports.slice(0, 5).map((report) => (
              <div key={report.id} className="p-3 border rounded-lg space-y-1" data-testid={`report-item-${report.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{report.title}</span>
                  <Badge variant={report.status === BugReportStatus.RESOLVED ? "default" : "secondary"} className="flex-shrink-0">
                    {report.status === BugReportStatus.RESOLVED ? (
                      <><Check className="h-3 w-3 mr-1" /> 처리 완료</>
                    ) : (
                      <><Clock className="h-3 w-3 mr-1" /> 대기 중</>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(report.createdAt!), "yyyy.MM.dd HH:mm", { locale: ko })}
                </p>
                {report.adminNote && report.status === BugReportStatus.RESOLVED && (
                  <p className="text-xs bg-muted p-2 rounded mt-1">
                    <span className="font-medium">관리자 답변:</span> {report.adminNote}
                  </p>
                )}
              </div>
            ))}
            {reports.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                외 {reports.length - 5}건 더 있음
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            아직 제보한 오류가 없습니다
          </p>
        )}
      </CardContent>
    </Card>
  );
}
