import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserRole, BugReportStatus, type BugReport } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bug, Check, Clock, Trash2, MessageSquare } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EnrichedBugReport extends BugReport {
  reporterName: string;
  centerName: string;
}

export default function BugReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<EnrichedBugReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");

  const { data: reports, isLoading } = useQuery<EnrichedBugReport[]>({
    queryKey: ["/api/bug-reports", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bug-reports?actorId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch bug reports");
      return res.json();
    },
    enabled: !!user && user.role === UserRole.ADMIN,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: string; status?: string; adminNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/bug-reports/${id}?actorId=${user?.id}`, { status, adminNote });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      setSelectedReport(null);
      toast({ title: "처리 완료" });
    },
    onError: () => {
      toast({ title: "처리에 실패했습니다", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/bug-reports/${id}?actorId=${user?.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bug-reports"] });
      setDeleteReportId(null);
      toast({ title: "삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  if (!user || user.role !== UserRole.ADMIN) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        관리자만 접근할 수 있습니다.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredReports = reports?.filter((r) => {
    if (filter === "pending") return r.status === BugReportStatus.PENDING;
    if (filter === "resolved") return r.status === BugReportStatus.RESOLVED;
    return true;
  }) || [];

  const pendingCount = reports?.filter((r) => r.status === BugReportStatus.PENDING).length || 0;
  const resolvedCount = reports?.filter((r) => r.status === BugReportStatus.RESOLVED).length || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6" />
            오류 제보 관리
          </h1>
          <p className="text-muted-foreground">원장님들이 제보한 오류를 확인하고 처리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            data-testid="button-filter-all"
          >
            전체 ({reports?.length || 0})
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            data-testid="button-filter-pending"
          >
            <Clock className="h-4 w-4 mr-1" />
            대기 중 ({pendingCount})
          </Button>
          <Button
            variant={filter === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("resolved")}
            data-testid="button-filter-resolved"
          >
            <Check className="h-4 w-4 mr-1" />
            처리 완료 ({resolvedCount})
          </Button>
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === "pending" ? "대기 중인 오류 제보가 없습니다" :
             filter === "resolved" ? "처리 완료된 오류 제보가 없습니다" :
             "오류 제보가 없습니다"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover-elevate cursor-pointer" onClick={() => {
              setSelectedReport(report);
              setAdminNote(report.adminNote || "");
            }} data-testid={`card-bug-report-${report.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>
                      {report.centerName} · {report.reporterName} · {format(new Date(report.createdAt!), "yyyy.MM.dd HH:mm", { locale: ko })}
                    </CardDescription>
                  </div>
                  <Badge variant={report.status === BugReportStatus.RESOLVED ? "default" : "secondary"}>
                    {report.status === BugReportStatus.RESOLVED ? (
                      <><Check className="h-3 w-3 mr-1" /> 처리 완료</>
                    ) : (
                      <><Clock className="h-3 w-3 mr-1" /> 대기 중</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                {report.adminNote && (
                  <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                    <span className="font-medium">관리자 메모:</span> {report.adminNote}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>
              {selectedReport?.centerName} · {selectedReport?.reporterName}
              {selectedReport?.createdAt && (
                <> · {format(new Date(selectedReport.createdAt), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">오류 내용</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{selectedReport?.description}</p>
            </div>
            <div>
              <h4 className="font-medium mb-1 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                관리자 메모
              </h4>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="처리 내용이나 메모를 입력하세요..."
                rows={3}
                data-testid="textarea-admin-note"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setDeleteReportId(selectedReport?.id || null);
                setSelectedReport(null);
              }}
              data-testid="button-delete-report"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              {selectedReport?.status === BugReportStatus.PENDING ? (
                <Button
                  onClick={() => updateMutation.mutate({ 
                    id: selectedReport.id, 
                    status: BugReportStatus.RESOLVED,
                    adminNote 
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-mark-resolved"
                >
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  처리 완료
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateMutation.mutate({ 
                      id: selectedReport!.id, 
                      status: BugReportStatus.PENDING,
                      adminNote 
                    })}
                    disabled={updateMutation.isPending}
                    data-testid="button-mark-pending"
                  >
                    대기 중으로 변경
                  </Button>
                  <Button
                    onClick={() => updateMutation.mutate({ 
                      id: selectedReport!.id, 
                      adminNote 
                    })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-note"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    메모 저장
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReportId} onOpenChange={(open) => !open && setDeleteReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>오류 제보 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 오류 제보를 삭제하시겠습니까? 삭제된 내용은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReportId && deleteMutation.mutate(deleteReportId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
