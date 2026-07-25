import { useState } from "react";
import { Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Feature } from "@shared/schema";
import { UserRole } from "@shared/schema";

interface ManualButtonProps {
  menuKey: string;
  className?: string;
}

export function ManualButton({ menuKey, className }: ManualButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");

  // Fetch feature directly by menuKey to avoid cache issues
  const { data: feature, isLoading } = useQuery<Feature>({
    queryKey: ["/api/features/by-menu-key", menuKey],
    queryFn: async () => {
      const res = await fetch(`/api/features/by-menu-key/${menuKey}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 0, // Always fetch fresh data
  });

  const videoUrl = feature?.videoUrl;

  const isAdmin = user?.role === UserRole.ADMIN;
  const isStudent = user?.role === UserRole.STUDENT;

  const updateVideoUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!feature) {
        throw new Error("Feature not found - menuKey: " + menuKey);
      }
      if (!user) {
        throw new Error("User not authenticated");
      }
      console.log("[ManualButton] Saving videoUrl:", url, "for feature:", feature.id);
      const response = await apiRequest("PATCH", `/api/features/${feature.id}?actorId=${user.id}`, { videoUrl: url || null });
      const result = await response.json();
      console.log("[ManualButton] Save result:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[ManualButton] Success, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["/api/features/by-menu-key", menuKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "매뉴얼 URL이 저장되었습니다" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      console.error("[ManualButton] Error:", error);
      toast({ title: "저장 실패: " + (error as Error).message, variant: "destructive" });
    },
  });

  const handleClick = () => {
    if (isAdmin) {
      setVideoUrlInput(videoUrl || "");
      setIsDialogOpen(true);
    } else if (videoUrl) {
      window.open(videoUrl, "_blank");
    }
  };

  const handleSave = () => {
    updateVideoUrlMutation.mutate(videoUrlInput.trim());
  };

  if (isStudent || (!isAdmin && !videoUrl)) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`shrink-0 ${videoUrl ? "" : "border-dashed"} ${className || ""}`}
            onClick={handleClick}
            data-testid={`button-manual-${menuKey}`}
          >
            <Youtube className={`h-4 w-4 mr-1 ${videoUrl ? "text-red-500" : "text-muted-foreground"}`} />
            <span className="text-xs">매뉴얼</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isAdmin ? (videoUrl ? "매뉴얼 URL 수정" : "매뉴얼 URL 등록") : "매뉴얼 영상 보기"}</p>
        </TooltipContent>
      </Tooltip>

      {isAdmin && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>매뉴얼 영상 URL</DialogTitle>
              <DialogDescription>
                이 기능의 사용법 영상 유튜브 URL을 입력하세요
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="videoUrl">유튜브 URL</Label>
                <Input
                  id="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  data-testid="input-manual-url"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                취소
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={updateVideoUrlMutation.isPending || isLoading}
                data-testid="button-save-manual-url"
              >
                {updateVideoUrlMutation.isPending ? "저장 중..." : isLoading ? "로딩 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
