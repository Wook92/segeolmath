import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  isPushSupported,
  subscribePush,
  unsubscribePush,
  isCurrentlySubscribed,
  verifyAndSyncSubscription,
  type SubscribeResult,
} from "@/lib/push-notifications";
import { apiRequest } from "@/lib/queryClient";

const PUSH_PROMPT_DISMISSED_KEY = (userId: string) => `push_prompt_dismissed_${userId}`;

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isPushSupported()) return;
    if (Notification.permission === "denied") return;

    let cancelled = false;
    const check = async () => {
      try {
        const dismissed = localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY(user.id)) === "true";
        const inSync = await verifyAndSyncSubscription(user.id);
        if (cancelled) return;
        if (inSync) return;
        if (dismissed) return;
        setDontShowAgain(false);
        setOpen(true);
      } catch {}
    };
    const t = setTimeout(check, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user?.id]);

  if (!user) return null;

  const persistDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY(user.id), "true");
    }
  };

  const handleAllow = async () => {
    setSubmitting(true);
    try {
      const result = await subscribePush(user.id, (user as any).currentCenterId);
      if (result.success) {
        toast({ title: "푸시 알림 활성화 완료", description: "이제 새 알림을 핸드폰으로 받을 수 있습니다." });
        localStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY(user.id));
        setOpen(false);
      } else {
        toast({ title: "푸시 알림 활성화 실패", description: result.reason, variant: "destructive" });
        persistDismiss();
        setOpen(false);
      }
    } catch (e: any) {
      toast({ title: "오류", description: e?.message || "처리 중 오류 발생", variant: "destructive" });
      persistDismiss();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    persistDismiss();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleDecline(); else setOpen(true); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            푸시 알림을 활성화하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription>
            앱을 사용하지 않을 때도 출결, 숙제, 평가 등 새 알림을 핸드폰에서 바로 받을 수 있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox
            id="push-prompt-dont-show"
            checked={dontShowAgain}
            onCheckedChange={(v) => setDontShowAgain(v === true)}
            data-testid="checkbox-push-prompt-dont-show"
          />
          <label htmlFor="push-prompt-dont-show" className="text-sm cursor-pointer select-none">
            앞으로 알림 안 보기
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDecline} data-testid="button-push-prompt-decline">아니요</AlertDialogCancel>
          <AlertDialogAction onClick={handleAllow} disabled={submitting} data-testid="button-push-prompt-allow">
            {submitting ? "처리 중..." : "예, 활성화"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PushNotificationToggle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      const sup = isPushSupported();
      setSupported(sup);
      if (sup) {
        const sub = await isCurrentlySubscribed();
        setSubscribed(sub);
      }
    };
    check();
  }, []);

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (subscribed) {
        const ok = await unsubscribePush();
        if (ok) {
          setSubscribed(false);
          toast({ title: "알림 해제", description: "푸시 알림이 해제되었습니다." });
        }
      } else {
        const result = await subscribePush(user.id, (user as any).currentCenterId);
        if (result.success) {
          setSubscribed(true);
          toast({ title: "알림 설정", description: "푸시 알림이 활성화되었습니다." });
        } else {
          toast({
            title: "알림 설정 실패",
            description: result.reason,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "오류",
        description: error?.message || "알림 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <Button
      variant={subscribed ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-2"
      data-testid="button-push-toggle"
    >
      {subscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {loading ? "처리 중..." : subscribed ? "알림 ON" : "알림 OFF"}
    </Button>
  );
}

export function PushNotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    const check = async () => {
      const sup = isPushSupported();
      setSupported(sup);
      if (sup && user) {
        const inSync = await verifyAndSyncSubscription(user.id);
        setSubscribed(inSync);
      } else if (sup) {
        const sub = await isCurrentlySubscribed();
        setSubscribed(sub);
      }
      if (user) {
        try {
          const res = await fetch(`/api/push/status?userId=${user.id}`);
          const data = await res.json();
          setDeviceCount(data.subscriptions || 0);
        } catch (e) {
          console.error("[Push] Status check failed:", e);
        }
      }
    };
    check();
  }, [user]);

  const refreshDeviceCount = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/push/status?userId=${user.id}`);
      const data = await res.json();
      setDeviceCount(data.subscriptions || 0);
    } catch {}
  };

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (subscribed) {
        const ok = await unsubscribePush();
        if (ok) {
          setSubscribed(false);
          toast({ title: "알림 해제 완료" });
          await refreshDeviceCount();
        }
      } else {
        const result = await subscribePush(user.id, (user as any).currentCenterId);
        if (result.success) {
          setSubscribed(true);
          toast({ title: "알림 설정 완료" });
          await refreshDeviceCount();
        } else {
          toast({
            title: "알림 설정 실패",
            description: result.reason,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({ title: "오류", description: error?.message || "처리 중 오류 발생", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!user) return;
    setTestSending(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success && data.sent > 0) {
        toast({ title: "테스트 알림 발송 완료", description: "잠시 후 알림이 도착합니다." });
      } else {
        toast({
          title: "테스트 알림 발송 실패",
          description: data.message || "등록된 기기가 없거나 발송에 실패했습니다. 알림을 다시 등록해 주세요.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "테스트 실패", description: "서버 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-lg border p-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2 mb-2">
          <BellOff className="h-5 w-5" />
          <span className="font-medium">푸시 알림 미지원</span>
        </div>
        <p>현재 브라우저가 웹 푸시 알림을 지원하지 않습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <span className="font-medium">푸시 알림</span>
        </div>
        <Button
          variant={subscribed ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={loading}
          className="gap-2"
          data-testid="button-push-settings-toggle"
        >
          {subscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {loading ? "처리 중..." : subscribed ? "활성화됨" : "비활성화"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        앱을 사용하지 않을 때도 새 알림(숙제, 평가 등)을 받을 수 있습니다.
      </p>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Smartphone className="h-4 w-4" />
          <span>등록된 기기: {deviceCount}개</span>
        </div>
      </div>

      {subscribed && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testSending}
          className="gap-2"
          data-testid="button-push-test"
        >
          <Send className="h-4 w-4" />
          {testSending ? "발송 중..." : "테스트 알림 보내기"}
        </Button>
      )}
    </div>
  );
}
