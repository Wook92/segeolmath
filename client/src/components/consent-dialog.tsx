import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle2 } from "lucide-react";

export function ConsentDialog() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);

  const consentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      return await apiRequest("POST", `/api/users/${user.id}/consent`);
    },
    onSuccess: () => {
      toast({ title: "동의 완료", description: "전자정보 이용에 동의하셨습니다." });
      updateUser({ consentAgreedAt: new Date() });
    },
    onError: (error: any) => {
      toast({ title: "동의 실패", description: error.message, variant: "destructive" });
    },
  });

  if (!user || user.consentAgreedAt) {
    return null;
  }

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">전자정보 이용 제공 동의서</DialogTitle>
          </div>
          <DialogDescription>
            서비스 이용을 위해 아래 내용을 확인하고 동의해 주세요.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[300px] border rounded-md p-4 bg-muted/30">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">제1조 (목적)</h3>
              <p className="text-muted-foreground leading-relaxed">
                본 동의서는 학원 통합 관리 시스템(이하 "서비스")의 이용과 관련하여 
                학원과 이용자 간의 전자정보 수집, 이용, 제공에 관한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제2조 (수집하는 개인정보)</h3>
              <p className="text-muted-foreground leading-relaxed">
                서비스 이용을 위해 다음의 개인정보를 수집합니다:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                <li>필수항목: 이름, 연락처(휴대폰 번호), 계정 정보</li>
                <li>선택항목: 학교, 학년, 학부모 연락처</li>
                <li>자동수집항목: 서비스 이용 기록, 접속 로그, 출결 정보</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제3조 (개인정보의 수집 및 이용 목적)</h3>
              <p className="text-muted-foreground leading-relaxed">
                수집된 개인정보는 다음의 목적으로 이용됩니다:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                <li>학원 수업 관리 및 출결 관리</li>
                <li>숙제, 평가, 학습 자료 제공</li>
                <li>학부모 연락 및 알림 서비스</li>
                <li>수강료 안내 및 결제 처리</li>
                <li>서비스 개선 및 통계 분석</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제4조 (개인정보의 보유 및 이용 기간)</h3>
              <p className="text-muted-foreground leading-relaxed">
                개인정보는 수집 목적이 달성된 후 지체 없이 파기됩니다. 
                단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관됩니다.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제5조 (개인정보의 제3자 제공)</h3>
              <p className="text-muted-foreground leading-relaxed">
                수집된 개인정보는 원칙적으로 제3자에게 제공하지 않습니다. 
                다만, 이용자의 동의가 있거나 법령에 의한 경우에는 예외로 합니다.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제6조 (이용자의 권리)</h3>
              <p className="text-muted-foreground leading-relaxed">
                이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있으며, 
                동의 철회를 요청할 수 있습니다.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">제7조 (동의 거부권 및 불이익)</h3>
              <p className="text-muted-foreground leading-relaxed">
                이용자는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 
                다만, 동의를 거부할 경우 서비스 이용이 제한될 수 있습니다.
              </p>
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox 
            id="consent-agree" 
            checked={agreed} 
            onCheckedChange={(checked) => setAgreed(checked === true)}
            data-testid="checkbox-consent-agree"
          />
          <label 
            htmlFor="consent-agree" 
            className="text-sm font-medium leading-none cursor-pointer"
          >
            위 내용을 모두 확인하였으며, 전자정보 이용에 동의합니다.
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={() => consentMutation.mutate()}
            disabled={!agreed || consentMutation.isPending}
            className="w-full"
            data-testid="button-consent-agree"
          >
            {consentMutation.isPending ? (
              "처리 중..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                동의하고 시작하기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
