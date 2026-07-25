import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@shared/schema";
import type { Center, SmsCredit, SmsCreditTransaction } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Loader2, Wallet, ArrowUpCircle, ArrowDownCircle, MessageCircle, AlertTriangle, Coins, Building2, BellOff } from "lucide-react";
import { useLocation } from "wouter";

export default function SmsCreditChargePage() {
  const { user, selectedCenter } = useAuth();
  const { toast } = useToast();
  const [chargeAmount, setChargeAmount] = useState(30000);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const isAdmin = user && user.role >= UserRole.ADMIN;

  const { data: allCenters = [] } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
    enabled: !!isAdmin,
  });

  const [viewCenterId, setViewCenterId] = useState<string>("");

  useEffect(() => {
    if (isAdmin && !viewCenterId) {
      setViewCenterId("__all__");
    } else if (!isAdmin && selectedCenter?.id) {
      setViewCenterId(selectedCenter.id);
    }
  }, [isAdmin, selectedCenter, viewCenterId]);

  const isAllCentersView = isAdmin && viewCenterId === "__all__";
  const centerId = isAllCentersView ? undefined : (isAdmin ? viewCenterId : selectedCenter?.id);

  const { data: centerData } = useQuery<Center>({
    queryKey: ["/api/centers", centerId],
    queryFn: async () => {
      const res = await fetch("/api/centers");
      const centers: Center[] = await res.json();
      return centers.find(c => c.id === centerId) || null;
    },
    enabled: !!centerId,
  });

  const { data: tossConfig } = useQuery<{ available: boolean; clientKey: string | null }>({
    queryKey: ["/api/payments/toss/config"],
    queryFn: () => fetch(`/api/payments/toss/config`).then(r => r.json()),
  });

  const { data: credit, refetch: refetchCredit } = useQuery<SmsCredit>({
    queryKey: ["/api/sms-credits", centerId],
    queryFn: () => fetch(`/api/sms-credits/${centerId}`).then(r => r.json()),
    enabled: !!centerId,
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery<SmsCreditTransaction[]>({
    queryKey: isAllCentersView
      ? ["/api/sms-credit-transactions", "all", user?.id]
      : ["/api/sms-credit-transactions", centerId],
    queryFn: () => {
      if (isAllCentersView) {
        return fetch(`/api/sms-credit-transactions?actorId=${user!.id}&limit=200`).then(r => r.json());
      }
      return fetch(`/api/sms-credit-transactions/${centerId}?limit=50`).then(r => r.json());
    },
    enabled: isAllCentersView ? !!user?.id : !!centerId,
  });

  const centerNameById = (id: string | null | undefined) =>
    allCenters.find(c => c.id === id)?.name || "";

  const isCreditMode = (centerData as any)?.smsMode === "credit";
  const balance = credit?.balance || 0;
  const isLowBalance = balance <= 5000;
  const notifyEnabled = credit?.lowBalanceNotifyEnabled !== false;

  const updateNotifyMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest("PATCH", `/api/sms-credits/${centerId}/notify`, {
        enabled,
        actorId: user?.id,
      });
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-credits", centerId] });
      toast({
        title: enabled ? "잔액 부족 알림 켜짐" : "잔액 부족 알림 꺼짐",
        description: enabled
          ? "잔액이 5,000원 이하가 되면 알림을 받습니다."
          : "잔액 부족 알림을 받지 않습니다. 잔액이 0원이 되면 문자 발송이 자동으로 중지됩니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "변경 실패",
        description: error?.message || "알림 설정을 변경할 수 없습니다.",
        variant: "destructive",
      });
    },
  });

  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseInt(adjustAmount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("올바른 금액을 입력해주세요");
      const finalAmount = adjustType === "subtract" ? -numAmount : numAmount;
      await apiRequest("POST", `/api/sms-credits/${centerId}/adjust`, {
        amount: finalAmount,
        reason: adjustReason || undefined,
        actorId: user!.id,
      });
    },
    onSuccess: () => {
      toast({ title: `잔액이 ${adjustType === "add" ? "증액" : "감액"}되었습니다` });
      setAdjustAmount("");
      setAdjustReason("");
      refetchCredit();
      refetchTransactions();
    },
    onError: (error: any) => {
      toast({ title: error.message || "조정 실패", variant: "destructive" });
    },
  });

  // 잔액충전 알림에서 도착한 경우 충전 다이얼로그 자동 열기
  const [location] = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const recharge = params.get("recharge");
    if (recharge) {
      const amt = parseInt(recharge);
      if (!isNaN(amt) && amt >= 30000) setChargeAmount(amt);
      setShowChargeDialog(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("recharge");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const loadTossSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).TossPayments) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://js.tosspayments.com/v1/payment";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("토스 결제 모듈 로드 실패"));
      document.head.appendChild(script);
    });
  };

  const handleTossPayment = async () => {
    const clientKey = tossConfig?.clientKey;
    if (!clientKey) {
      toast({ title: "결제 키가 설정되지 않았습니다. 관리자에게 문의하세요.", variant: "destructive" });
      return;
    }
    if (!tossConfig?.available) {
      toast({ title: "토스페이먼츠 결제가 설정되지 않았습니다. 관리자에게 문의하세요.", variant: "destructive" });
      return;
    }
    try {
      await loadTossSDK();
    } catch {
      toast({ title: "결제 모듈을 불러올 수 없습니다.", variant: "destructive" });
      return;
    }

    if (chargeAmount < 30000) {
      toast({ title: "최소 충전 금액은 30,000원입니다.", variant: "destructive" });
      return;
    }

    const orderId = `sms-credit-${centerId!.slice(0, 8)}-${Date.now()}`;
    const tossPayments = (window as any).TossPayments(clientKey);
    const centerName = (centerData as any)?.name || "학원";

    try {
      setIsProcessingPayment(true);
      const result = await tossPayments.requestPayment("카드", {
        amount: chargeAmount,
        orderId,
        orderName: `문자 크레딧 충전 (${chargeAmount.toLocaleString()}원)`,
        customerName: centerName,
        successUrl: `${window.location.origin}/api/payments/toss/success`,
        failUrl: `${window.location.origin}/api/payments/toss/fail`,
      });

      if (result?.paymentKey) {
        const confirmRes = await apiRequest("POST", "/api/payments/toss/confirm", {
          paymentKey: result.paymentKey,
          orderId: result.orderId,
          amount: chargeAmount,
          centerId,
        });
        if (confirmRes.ok) {
          toast({ title: `${chargeAmount.toLocaleString()}원 충전 완료!` });
          queryClient.invalidateQueries({ queryKey: ["/api/sms-credits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/sms-credit-transactions"] });
          setShowChargeDialog(false);
        }
      }
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.code === "PAY_PROCESS_CANCELED" || error?.code === "PAY_PROCESS_ABORTED") {
        return;
      }
      console.error("Toss payment error:", error);
      toast({ title: error?.message || "결제에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (!user || (user.role < UserRole.PRINCIPAL)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">원장 이상 계정만 접근 가능합니다.</p>
      </div>
    );
  }

  if (!centerId && !isAllCentersView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">센터를 선택해주세요.</p>
      </div>
    );
  }

  const ADMIN_PHONE = "01055147588";

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4 space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">잔액충전</h1>

      {isAdmin && allCenters.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">센터 선택</Label>
            </div>
            <Select value={viewCenterId} onValueChange={setViewCenterId}>
              <SelectTrigger data-testid="select-view-center">
                <SelectValue placeholder="센터를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체 (모든 센터 내역)</SelectItem>
                {allCenters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAllCentersView && (
              <p className="text-xs text-muted-foreground mt-2">
                모든 센터의 충전·차감 내역을 시간 순서대로 확인합니다. 학원을 선택하면 해당 학원의 충전 잔액이 표시됩니다.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!isAllCentersView && !isCreditMode && centerData && (
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                문자 전송 이용하려면 관리자에게 문의주세요
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                충전 후 문자 발송 기능을 활성화하려면 관리자의 설정이 필요합니다.
              </p>
              <a
                href={`sms:${ADMIN_PHONE}`}
                className="inline-flex items-center gap-1.5 mt-1"
                data-testid="link-contact-admin"
              >
                <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  관리자에게 문의하기
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}

      {!isAllCentersView && (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">충전 잔액</span>
            </div>
            {isLowBalance && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-low-balance">잔액 부족</Badge>
            )}
          </div>
          <div className={`text-3xl font-bold ${isLowBalance ? "text-destructive" : ""}`} data-testid="text-balance">
            {balance.toLocaleString()}원
          </div>
          <div className="mt-4">
            <Button
              onClick={() => setShowChargeDialog(true)}
              className="w-full"
              data-testid="button-open-charge"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              충전하기
            </Button>
          </div>
          <div className="mt-4 pt-4 border-t flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BellOff className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="toggle-low-balance-notify" className="text-sm font-medium cursor-pointer">
                  잔액 부족 알림 받기
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                문자 기능을 사용하지 않는 경우 알림을 끄세요. 잔액이 0원이 되면 문자 발송은 자동으로 중지됩니다.
              </p>
            </div>
            <Switch
              id="toggle-low-balance-notify"
              checked={notifyEnabled}
              disabled={!centerId || updateNotifyMutation.isPending}
              onCheckedChange={(v) => updateNotifyMutation.mutate(v)}
              data-testid="switch-low-balance-notify"
            />
          </div>
        </CardContent>
      </Card>
      )}

      {!isAllCentersView && !tossConfig?.available && (
        <div className="p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
          <p className="text-xs text-orange-700 dark:text-orange-300">
            충전하려면 관리자가 충전용 토스페이먼츠 키를 등록해야 합니다.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <span className="font-medium">문자 요금 안내</span>
            <div className="flex gap-6 mt-2 text-muted-foreground">
              <span>SMS: 28원</span>
              <span>LMS: 55원</span>
              <span>MMS: 120원</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">최소 충전 금액: 30,000원</p>
          </div>
        </CardContent>
      </Card>

      {isAdmin && !isAllCentersView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-5 w-5" />
              충전액 조정
            </CardTitle>
            <CardDescription>관리자가 직접 잔액을 증액/감액할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustType === "add" ? "default" : "outline"}
                size="sm"
                onClick={() => setAdjustType("add")}
                data-testid="button-adjust-add"
              >
                증액
              </Button>
              <Button
                type="button"
                variant={adjustType === "subtract" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setAdjustType("subtract")}
                data-testid="button-adjust-subtract"
              >
                감액
              </Button>
            </div>
            <div className="space-y-2">
              <Label>조정 금액 (원)</Label>
              <Input
                type="number"
                min="1"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="금액 입력"
                data-testid="input-adjust-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>사유 (선택)</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="예: 이벤트 보너스, 오류 정정 등"
                data-testid="input-adjust-reason"
              />
            </div>
            <Button
              onClick={() => {
                const num = parseInt(adjustAmount);
                if (isNaN(num) || num <= 0) {
                  toast({ title: "올바른 금액을 입력해주세요", variant: "destructive" });
                  return;
                }
                if (confirm(`${adjustType === "add" ? "증액" : "감액"} ${num.toLocaleString()}원을 진행하시겠습니까?`)) {
                  adjustMutation.mutate();
                }
              }}
              disabled={adjustMutation.isPending || !adjustAmount}
              className="w-full"
              variant={adjustType === "subtract" ? "destructive" : "default"}
              data-testid="button-adjust-confirm"
            >
              {adjustMutation.isPending ? "처리 중..." : `${adjustType === "add" ? "증액" : "감액"} 적용`}
            </Button>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="text-base">충전/차감 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">아직 내역이 없습니다.</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-muted/50 border-b last:border-0" data-testid={`row-transaction-${tx.id}`}>
                    <div className="flex items-start gap-3">
                      {tx.amount > 0 ? (
                        <ArrowUpCircle className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAllCentersView && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-tx-center-${tx.id}`}>
                              {centerNameById(tx.centerId) || "-"}
                            </Badge>
                          )}
                          <span className="text-sm">{tx.description}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : ""}
                        </div>
                      </div>
                    </div>
                    <span className={`font-medium text-sm shrink-0 ${tx.amount > 0 ? "text-blue-600 dark:text-blue-400" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>크레딧 충전</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>충전 금액</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[30000, 50000, 100000].map(amt => (
                  <Button
                    key={amt}
                    variant={chargeAmount === amt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChargeAmount(amt)}
                    data-testid={`button-amount-${amt}`}
                  >
                    {(amt / 10000)}만원
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(Math.max(30000, parseInt(e.target.value) || 30000))}
                className="mt-2"
                min={30000}
                step={10000}
                data-testid="input-charge-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">최소 30,000원부터 충전 가능합니다.</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span>현재 잔액</span>
                <span>{balance.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-sm font-medium mt-1">
                <span>충전 후 잔액</span>
                <span className="text-blue-600 dark:text-blue-400">{(balance + chargeAmount).toLocaleString()}원</span>
              </div>
            </div>
            <Button
              onClick={handleTossPayment}
              disabled={isProcessingPayment || chargeAmount < 30000}
              className="w-full"
              data-testid="button-confirm-charge"
            >
              {isProcessingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
              {chargeAmount.toLocaleString()}원 결제하기
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              충전된 금액은 환불되지 않습니다.
            </p>
            {!tossConfig?.available && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                결제 시스템이 배포 환경에서만 사용 가능합니다.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
