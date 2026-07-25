import webpush from "web-push";
import { db } from "../db";
import { pushSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(
        "mailto:admin@eumwithus.com",
        publicKey,
        privateKey
      );
      vapidConfigured = true;
      console.log("[WebPush] VAPID keys configured successfully");
      return true;
    } catch (error) {
      console.error("[WebPush] Failed to set VAPID details:", error);
      return false;
    }
  } else {
    console.warn("[WebPush] VAPID keys not found - VAPID_PUBLIC_KEY:", publicKey ? "set" : "MISSING", "VAPID_PRIVATE_KEY:", privateKey ? "set" : "MISSING");
    return false;
  }
}

ensureVapidConfigured();

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; badge?: string; url?: string; tag?: string }
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    console.warn(`[WebPush] Cannot send push to ${userId} - VAPID not configured`);
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  console.log(`[WebPush] Sending to userId: ${userId}, found ${subscriptions.length} subscription(s), payload: ${payload.title}`);

  if (subscriptions.length === 0) {
    console.log(`[WebPush] No subscriptions found for userId: ${userId}`);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );
      sent++;
      console.log(`[WebPush] Sent successfully to subscription ${sub.id} for user ${userId}`);

      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } catch (error: any) {
      failed++;
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        console.log(`[WebPush] Removed expired/invalid subscription ${sub.id} for user ${userId} (status: ${error.statusCode})`);
      } else {
        console.error(`[WebPush] Failed to send to user ${userId}, sub ${sub.id}:`, error.statusCode, error.message);
      }
    }
  }

  console.log(`[WebPush] Result for userId ${userId}: sent=${sent}, failed=${failed}`);
  return { sent, failed };
}

export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: { title: string; body: string; icon?: string; badge?: string; url?: string; tag?: string }
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}
