import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Smartphone, Upload, Loader2, Image as ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface InstallGuideImages {
  step1_browser?: string;
  step2_menu?: string;
  step4_iphone_share?: string;
  step5_iphone_add?: string;
  step4_galaxy_menu?: string;
  step5_galaxy_add?: string;
}

const stepLabels: Record<string, { label: string; description: string }> = {
  step1_browser: { label: "1단계: 브라우저 안내", description: "크롬/사파리 앱 아이콘 이미지" },
  step2_menu: { label: "2단계: 메뉴 버튼", description: "홈화면에 추가 메뉴 위치 이미지" },
  step4_iphone_share: { label: "4단계 (아이폰): 공유 버튼", description: "아이폰 공유 버튼 위치 이미지" },
  step5_iphone_add: { label: "5단계 (아이폰): 홈화면에 추가", description: "아이폰 홈화면 추가 버튼 이미지" },
  step4_galaxy_menu: { label: "4단계 (갤럭시): 메뉴 버튼", description: "갤럭시 메뉴 버튼 위치 이미지" },
  step5_galaxy_add: { label: "5단계 (갤럭시): 홈화면에 추가", description: "갤럭시 홈화면 추가 버튼 이미지" },
};

export function InstallGuideAdminSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: images, isLoading } = useQuery<InstallGuideImages>({
    queryKey: ["/api/install-guide/images"],
  });

  const updateImageMutation = useMutation({
    mutationFn: async ({ key, url }: { key: string; url: string }) => {
      const res = await apiRequest("POST", "/api/install-guide/images", { key, url, actorId: user?.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/install-guide/images"] });
      toast({ title: "이미지가 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "이미지 저장에 실패했습니다", variant: "destructive" });
    },
  });

  const handleUpload = async (key: string, file: File) => {
    try {
      setUploadingKey(key);

      // Use server-side upload to avoid CORS issues with R2
      const formData = new FormData();
      formData.append("file", file);
      formData.append("actorId", user?.id || "");

      const uploadRes = await fetch("/api/install-guide/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || "이미지 업로드에 실패했습니다");
      }

      const { publicUrl } = await uploadRes.json();
      await updateImageMutation.mutateAsync({ key, url: publicUrl });
    } catch (error: any) {
      toast({ title: error.message || "업로드 실패", variant: "destructive" });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleFileSelect = (key: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUpload(key, file);
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          홈화면 설치 가이드 이미지 설정
        </CardTitle>
        <CardDescription>
          학생/학부모에게 보여지는 홈화면 바로가기 설치 가이드의 단계별 이미지를 설정합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(stepLabels).map(([key, { label, description }]) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex items-start gap-4">
              {images?.[key as keyof InstallGuideImages] ? (
                <div className="relative">
                  <img
                    src={images[key as keyof InstallGuideImages]}
                    alt={label}
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => updateImageMutation.mutate({ key, url: "" })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => handleFileSelect(key)}
                disabled={uploadingKey === key}
                className="gap-2"
              >
                {uploadingKey === key ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    이미지 업로드
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
