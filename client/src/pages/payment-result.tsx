import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function PaymentResult() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "fail">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentKey = urlParams.get("paymentKey");
    const orderId = urlParams.get("orderId");
    const amount = urlParams.get("amount");
    const code = urlParams.get("code");
    const errorMessage = urlParams.get("message");

    if (code || errorMessage) {
      setStatus("fail");
      setMessage(errorMessage || "결제가 취소되었습니다.");
      return;
    }

    if (paymentKey && orderId && amount) {
      confirmPayment(paymentKey, orderId, parseInt(amount));
    } else {
      setStatus("fail");
      setMessage("결제 정보가 올바르지 않습니다.");
    }
  }, []);

  const confirmPayment = async (paymentKey: string, orderId: string, amount: number) => {
    try {
      const response = await apiRequest("POST", "/api/payments/confirm", {
        paymentKey,
        orderId,
        amount,
      });

      if (response.ok) {
        setStatus("success");
        setMessage("결제가 완료되었습니다.");
      } else {
        const data = await response.json();
        setStatus("fail");
        setMessage(data.error || "결제 확인에 실패했습니다.");
      }
    } catch (error: any) {
      setStatus("fail");
      setMessage(error.message || "결제 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center gap-4">
            {status === "loading" && (
              <>
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <span>결제 처리 중...</span>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="w-16 h-16 text-green-500" />
                <span className="text-green-600">결제 완료</span>
              </>
            )}
            {status === "fail" && (
              <>
                <XCircle className="w-16 h-16 text-destructive" />
                <span className="text-destructive">결제 실패</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{message}</p>
          
          {status !== "loading" && (
            <Button
              className="w-full"
              onClick={() => setLocation("/tuition")}
              data-testid="button-back-to-tuition"
            >
              교육비 페이지로 돌아가기
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
