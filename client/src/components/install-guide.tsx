import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, ChevronRight, ChevronLeft, Check, AlertTriangle } from "lucide-react";

const INSTALL_COMPLETED_KEY = "pwa_install_guide_completed";

interface InstallGuideImages {
  step1_browser?: string;
  step2_menu?: string;
  step4_iphone_share?: string;
  step5_iphone_add?: string;
  step4_galaxy_menu?: string;
  step5_galaxy_add?: string;
}

export function InstallGuideBanner() {
  const { user } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const [hasCompletedGuide, setHasCompletedGuide] = useState(false);

  const userCompletedKey = user?.id ? `${INSTALL_COMPLETED_KEY}_${user.id}` : INSTALL_COMPLETED_KEY;

  useEffect(() => {
    if (!user?.id) return;
    const completed = localStorage.getItem(userCompletedKey);
    if (completed === "true") {
      setHasCompletedGuide(true);
    }
  }, [user?.id, userCompletedKey]);

  if (!user) return null;
  if (user.role === UserRole.ADMIN || user.role === UserRole.KIOSK) return null;
  if (hasCompletedGuide) return null;

  return (
    <>
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">홈화면에 바로가기 버튼을 만들어서 앱을 사용하세요</p>
                <p className="text-xs text-muted-foreground">더 빠르고 편리하게 앱에 접근할 수 있습니다</p>
              </div>
            </div>
            <Button 
              onClick={() => setShowGuide(true)}
              size="sm"
              className="gap-1"
              data-testid="button-start-install-guide"
            >
              홈화면에 바로가기 만들기 시작하기
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <InstallGuideWizard 
        open={showGuide} 
        onOpenChange={setShowGuide}
        onComplete={() => {
          localStorage.setItem(userCompletedKey, "true");
          setHasCompletedGuide(true);
        }}
      />
    </>
  );
}

interface InstallGuideWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

function InstallGuideWizard({ open, onOpenChange, onComplete }: InstallGuideWizardProps) {
  const [step, setStep] = useState(1);
  const [deviceType, setDeviceType] = useState<"iphone" | "galaxy" | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const { data: images } = useQuery<InstallGuideImages>({
    queryKey: ["/api/install-guide/images"],
    enabled: open,
  });

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setDeviceType(null);
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3 && deviceType) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else if (step === 5) {
      setShowWarning(true);
    }
  };

  const handlePrev = () => {
    if (step === 5) {
      setStep(4);
    } else if (step === 4) {
      setStep(3);
    } else if (step === 3) {
      setStep(2);
      setDeviceType(null);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleComplete = () => {
    setShowWarning(false);
    onComplete();
    handleClose();
  };

  const getStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">1단계: 올바른 브라우저로 접속하기</p>
              <p className="text-muted-foreground">
                <strong className="text-red-500 text-base">갤럭시</strong>는 <strong className="text-red-500 text-base">크롬</strong> 또는 <strong className="text-red-500 text-base">구글 앱</strong>으로<br />
                <strong className="text-red-500 text-base">아이폰</strong>은 <strong className="text-red-500 text-base">사파리 앱</strong>으로<br />
                접속해주세요.
              </p>
            </div>
            {images?.step1_browser && (
              <img 
                src={images.step1_browser} 
                alt="브라우저 안내" 
                className="w-full rounded-lg border"
              />
            )}
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-center font-medium">해당 앱으로 접속하셨나요?</p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">2단계: 메뉴 버튼 찾기</p>
              <p className="text-muted-foreground">
                우측 상단에 사진과 같은 아이콘을 눌러<br />
                <strong>"홈 화면에 추가"</strong> 버튼을 눌러주세요.
              </p>
            </div>
            {images?.step2_menu && (
              <img 
                src={images.step2_menu} 
                alt="메뉴 버튼 안내" 
                className="w-full rounded-lg border"
              />
            )}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  <strong>주의사항:</strong> 홈화면에 설치가 완료되었다는 알림이 뜰 때까지 화면을 나가지 마세요.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center space-y-3">
              <p className="font-medium">홈화면에 바로가기 버튼이 만들어졌나요?</p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(3)}
                  data-testid="button-shortcut-no"
                >
                  아니오
                </Button>
                <Button
                  onClick={() => {
                    onComplete();
                    onOpenChange(false);
                    setStep(1);
                    setDeviceType(null);
                  }}
                  data-testid="button-shortcut-yes"
                >
                  예
                </Button>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-4">3단계: 핸드폰 기종 선택</p>
              <p className="text-muted-foreground mb-6">사용 중인 핸드폰 기종을 선택해주세요.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={deviceType === "iphone" ? "default" : "outline"}
                className="h-24 flex-col gap-2"
                onClick={() => setDeviceType("iphone")}
                data-testid="button-select-iphone"
              >
                <span className="text-2xl">📱</span>
                <span>아이폰</span>
              </Button>
              <Button
                variant={deviceType === "galaxy" ? "default" : "outline"}
                className="h-24 flex-col gap-2"
                onClick={() => setDeviceType("galaxy")}
                data-testid="button-select-galaxy"
              >
                <span className="text-2xl">📱</span>
                <span>갤럭시</span>
              </Button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">4단계: {deviceType === "iphone" ? "공유 버튼 누르기" : "메뉴 버튼 누르기"}</p>
              <p className="text-muted-foreground">
                {deviceType === "iphone" 
                  ? "화면 하단의 공유 버튼을 눌러주세요."
                  : "사진에 표기된 부분을 눌러주세요."
                }
              </p>
            </div>
            {deviceType === "iphone" && images?.step4_iphone_share && (
              <img 
                src={images.step4_iphone_share} 
                alt="아이폰 공유 버튼" 
                className="w-full rounded-lg border"
              />
            )}
            {deviceType === "galaxy" && images?.step4_galaxy_menu && (
              <img 
                src={images.step4_galaxy_menu} 
                alt="갤럭시 메뉴 버튼" 
                className="w-full rounded-lg border"
              />
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">5단계: 홈화면에 추가</p>
              <p className="text-muted-foreground">
                <strong>"홈 화면에 추가"</strong> 버튼을 눌러주세요.
              </p>
            </div>
            {deviceType === "iphone" && images?.step5_iphone_add && (
              <img 
                src={images.step5_iphone_add} 
                alt="아이폰 홈화면 추가" 
                className="w-full rounded-lg border"
              />
            )}
            {deviceType === "galaxy" && images?.step5_galaxy_add && (
              <img 
                src={images.step5_galaxy_add} 
                alt="갤럭시 홈화면 추가" 
                className="w-full rounded-lg border"
              />
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              홈화면에 바로가기 만들기
            </DialogTitle>
            <DialogDescription>
              단계별 안내를 따라 진행해주세요 ({step}/5)
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {getStepContent()}
          </div>

          <DialogFooter className="flex-row justify-between gap-2">
            <Button
              variant="outline"
              onClick={step === 1 ? handleClose : handlePrev}
              data-testid="button-prev-step"
            >
              {step === 1 ? "닫기" : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  이전
                </>
              )}
            </Button>
            {step !== 2 && (
              <Button
                onClick={handleNext}
                disabled={step === 3 && !deviceType}
                data-testid="button-next-step"
              >
                {step === 5 ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    완료
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              설치 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              설치가 완료되었다는 알림이 뜰 때까지 화면을 나가지 마세요.
              <br /><br />
              <strong>설치가 완료되었나요?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowWarning(false)}>
              아니오
            </Button>
            <AlertDialogAction onClick={handleComplete} data-testid="button-confirm-install">
              예
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
