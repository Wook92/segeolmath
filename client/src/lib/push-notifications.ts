export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushPermissionState(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    const data = await res.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type SubscribeResult = { success: true } | { success: false; reason: string };

export async function subscribePush(userId: string, centerId?: string): Promise<SubscribeResult> {
  try {
    if (!isPushSupported()) {
      return { success: false, reason: "이 브라우저에서는 푸시 알림을 지원하지 않습니다." };
    }

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      return { success: false, reason: "서버에서 푸시 설정 키를 가져올 수 없습니다." };
    }

    const permission = await Notification.requestPermission();
    if (permission === "denied") {
      return { success: false, reason: "알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해 주세요." };
    }
    if (permission !== "granted") {
      return { success: false, reason: "알림 권한이 허용되지 않았습니다." };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const subJson = subscription.toJSON();

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        centerId,
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      return { success: false, reason: "서버에 구독 정보를 저장하지 못했습니다." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Push] Subscribe error:", error);
    return { success: false, reason: error?.message || "알 수 없는 오류가 발생했습니다." };
  }
}

export async function unsubscribePush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const res = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!res.ok) {
        console.error("[Push] Backend unsubscribe failed");
      }
    }

    return true;
  } catch (error) {
    console.error("[Push] Unsubscribe error:", error);
    return false;
  }
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * 브라우저에는 PushSubscription이 남아있지만 서버 DB에는 기록이 없는 경우(고아 구독)를 감지하여
 * 브라우저 측 구독을 자동으로 해제합니다. 사용자가 다시 정상적으로 활성화 안내를 받을 수 있게 합니다.
 * Returns: true이면 서버와 동기화된 정상 구독 상태, false이면 미구독(또는 정리 후 미구독).
 */
export async function verifyAndSyncSubscription(userId: string): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    const browserSub = await registration.pushManager.getSubscription();
    if (!browserSub) return false;

    let serverCount = 0;
    try {
      const res = await fetch(`/api/push/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        serverCount = data.subscriptions || 0;
      }
    } catch {}

    if (serverCount === 0) {
      try {
        const endpoint = browserSub.endpoint;
        await browserSub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      } catch {}
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
