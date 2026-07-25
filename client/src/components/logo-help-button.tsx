import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface LogoHelpImage {
  id: number;
  logoType: string;
  imageUrl: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const LOGO_TYPE_LABELS: Record<string, string> = {
  loginLogo: "로그인 페이지 로고",
  sidebarLogo: "사이드바 로고",
  favicon: "파비콘",
  attendancePadLogo: "출결패드 로고",
  shortcutIcon: "홈화면 바로가기 아이콘",
};

const LOGO_TYPE_DESCRIPTIONS: Record<string, string> = {
  loginLogo: "로그인 페이지 상단에 표시되는 로고입니다.",
  sidebarLogo: "사이드바 상단에 표시되는 로고입니다. 모바일에서는 헤더에 표시됩니다.",
  favicon: "브라우저 탭에 표시되는 작은 아이콘입니다. 32x32 크기를 권장합니다.",
  attendancePadLogo: "출결패드 화면에 표시되는 로고입니다.",
  shortcutIcon: "모바일 홈화면에 바로가기 추가 시 표시되는 아이콘입니다. 192x192 크기를 권장합니다.",
};

interface LogoHelpButtonProps {
  logoType: string;
}

export function LogoHelpButton({ logoType }: LogoHelpButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: helpImage, isLoading } = useQuery<LogoHelpImage | null>({
    queryKey: ["/api/logo-help-images", logoType],
    queryFn: async () => {
      const res = await fetch(`/api/logo-help-images/${logoType}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open,
  });

  const label = LOGO_TYPE_LABELS[logoType] || logoType;
  const description = LOGO_TYPE_DESCRIPTIONS[logoType] || "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center rounded text-muted-foreground hover-elevate"
          data-testid={`button-logo-help-${logoType}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{label} 사용 예시</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-48 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">로딩중...</p>
            </div>
          ) : helpImage?.imageUrl ? (
            <div className="rounded-md overflow-hidden border">
              <img 
                src={helpImage.imageUrl} 
                alt={`${label} 사용 예시`}
                className="w-full object-contain max-h-96"
              />
              {helpImage.description && (
                <p className="text-xs text-muted-foreground p-2 bg-muted">{helpImage.description}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-md">
              <HelpCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">등록된 예시 이미지가 없습니다</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
