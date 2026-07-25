import { SolapiMessageService } from "solapi";
import crypto from "crypto";
import { storage } from "../storage";
import { decrypt } from "../crypto";

// Production-safe logging
const isProduction = process.env.NODE_ENV === "production";
function debugLog(...args: any[]) {
  if (!isProduction) console.log(...args);
}

interface CenterCredentials {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
}

// Simple cache with TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
const LOW_BALANCE_THRESHOLD = 5000;
const LOW_BALANCE_COOLDOWN_MS = 60 * 60 * 1000;
const lowBalanceNotifyAt: Map<string, number> = new Map();
const centerNameToIdCache: Map<string, { value: string; expires: number }> = new Map();
const messageServicesCache: Map<string, { value: SolapiMessageService; expires: number }> = new Map();
const noCredsCache: Map<string, number> = new Map();

function getCachedValue<T>(cache: Map<string, { value: T; expires: number }>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) {
    return entry.value;
  }
  if (entry) cache.delete(key);
  return null;
}

function setCachedValue<T>(cache: Map<string, { value: T; expires: number }>, key: string, value: T): void {
  // Limit cache size to prevent memory leaks
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

// Clear cache for a specific center when credentials are updated
export function clearCredentialsCache(centerName?: string): void {
  if (centerName) {
    centerNameToIdCache.delete(centerName);
    noCredsCache.delete(centerName);
    for (const key of messageServicesCache.keys()) {
      if (key.startsWith(centerName)) {
        messageServicesCache.delete(key);
      }
    }
    debugLog(`[SOLAPI] Cleared cache for center: ${centerName}`);
  } else {
    // Clear all caches
    centerNameToIdCache.clear();
    messageServicesCache.clear();
    noCredsCache.clear();
    debugLog("[SOLAPI] Cleared all credential caches");
  }
}

const envCredentials: Record<string, Partial<CenterCredentials>> = {
  "DMC센터": {
    apiKey: process.env.SOLAPI_API_KEY_DMC,
    apiSecret: process.env.SOLAPI_API_SECRET_DMC,
    senderNumber: process.env.SOLAPI_SENDER_NUMBER_DMC,
  },
  "목동센터": {
    apiKey: process.env.SOLAPI_API_KEY,
    apiSecret: process.env.SOLAPI_API_SECRET,
    senderNumber: process.env.SOLAPI_SENDER_NUMBER_MOKDONG,
  },
};

// Get system admin credentials (always uses environment variables, never DB)
// Priority: 목동센터 first, then DMC센터 as fallback
function getSystemCredentials(): CenterCredentials | null {
  const mokdongCreds = envCredentials["목동센터"];
  if (mokdongCreds?.apiKey && mokdongCreds?.apiSecret && mokdongCreds?.senderNumber) {
    return mokdongCreds as CenterCredentials;
  }
  
  const dmcCreds = envCredentials["DMC센터"];
  if (dmcCreds?.apiKey && dmcCreds?.apiSecret && dmcCreds?.senderNumber) {
    return dmcCreds as CenterCredentials;
  }
  
  return null;
}

async function getCenterIdByName(centerName: string): Promise<string | null> {
  const cached = getCachedValue(centerNameToIdCache, centerName);
  if (cached) return cached;
  
  try {
    const centers = await storage.getCenters();
    const center = centers.find(c => c.name === centerName);
    if (center) {
      setCachedValue(centerNameToIdCache, centerName, center.id);
      return center.id;
    }
    console.log(`[SOLAPI] Center not found by name "${centerName}". Available centers: ${centers.map(c => `${c.name}(${c.id})`).join(', ')}`);
  } catch (error) {
    console.error("[SOLAPI] Error getting center ID:", error);
  }
  return null;
}

async function getCredentialsFromDb(centerId: string): Promise<CenterCredentials | null> {
  try {
    console.log(`[SOLAPI] Looking up DB credentials for centerId=${centerId}`);
    const dbCreds = await storage.getSolapiCredentials(centerId);
    if (dbCreds) {
      console.log(`[SOLAPI] DB record found for centerId=${centerId} (id=${dbCreds.id}, senderNumber=${dbCreds.senderNumber ? dbCreds.senderNumber.slice(0, 3) + '****' : 'empty'}, apiKeyLen=${dbCreds.apiKey?.length || 0}, apiSecretLen=${dbCreds.apiSecret?.length || 0})`);
      const apiKey = decrypt(dbCreds.apiKey);
      const apiSecret = decrypt(dbCreds.apiSecret);
      const senderNumber = dbCreds.senderNumber;
      console.log(`[SOLAPI] Decrypted credentials: apiKey=${apiKey ? 'OK(' + apiKey.length + ')' : 'FAILED'}, apiSecret=${apiSecret ? 'OK(' + apiSecret.length + ')' : 'FAILED'}, sender=${senderNumber ? senderNumber.slice(0, 3) + '****' : 'empty'}, senderLen=${senderNumber?.length || 0}`);
      if (apiKey && apiSecret && senderNumber && senderNumber.length >= 8) {
        return { apiKey, apiSecret, senderNumber };
      }
      console.log(`[SOLAPI] DB credentials for centerId=${centerId} incomplete or invalid (apiKey=${!!apiKey}, apiSecret=${!!apiSecret}, sender=${senderNumber ? senderNumber.slice(0, 3) + '****' : 'empty'}, senderLen=${senderNumber?.length || 0}, minLen=8)`);
    } else {
      console.log(`[SOLAPI] No DB record found for centerId=${centerId}`);
    }
  } catch (error) {
    console.error("[SOLAPI] Error decrypting credentials from DB:", error);
  }
  return null;
}

async function getCredentials(centerName: string): Promise<CenterCredentials | null> {
  const noCacheExpiry = noCredsCache.get(centerName);
  if (noCacheExpiry && Date.now() < noCacheExpiry) {
    return null;
  }

  try {
    const centers = await storage.getCenters();
    const matchingCenters = centers.filter(c => c.name === centerName);
    
    if (matchingCenters.length > 1) {
      console.log(`[SOLAPI] Multiple centers found for "${centerName}": ${matchingCenters.map(c => c.id).join(', ')}`);
    }

    for (const center of matchingCenters) {
      console.log(`[SOLAPI] getCredentials: centerName="${centerName}" → trying centerId=${center.id}`);
      const dbCreds = await getCredentialsFromDb(center.id);
      if (dbCreds && dbCreds.apiKey && dbCreds.apiSecret && dbCreds.senderNumber) {
        console.log(`[SOLAPI] Using DB credentials for ${centerName} (centerId=${center.id})`);
        setCachedValue(centerNameToIdCache, centerName, center.id);
        return dbCreds;
      }
    }

    if (matchingCenters.length === 0) {
      console.log(`[SOLAPI] No center found by name "${centerName}"`);
    }
  } catch (error) {
    console.error("[SOLAPI] Error looking up credentials:", error);
  }
  
  const envCreds = envCredentials[centerName];
  if (envCreds?.apiKey && envCreds?.apiSecret && envCreds?.senderNumber) {
    console.log(`[SOLAPI] Using env credentials for ${centerName}`);
    return envCreds as CenterCredentials;
  }
  
  console.log(`[SOLAPI] No credentials found for ${centerName} (hasEnvCreds=${!!envCreds})`);
  noCredsCache.set(centerName, Date.now() + CACHE_TTL);
  return null;
}

async function getMessageService(centerName: string): Promise<SolapiMessageService | null> {
  const creds = await getCredentials(centerName);
  if (!creds) {
    return null;
  }
  
  const cacheKey = `${centerName}_${creds.apiKey.slice(-4)}`;
  const cached = getCachedValue(messageServicesCache, cacheKey);
  if (cached) return cached;
  
  const service = new SolapiMessageService(creds.apiKey, creds.apiSecret);
  setCachedValue(messageServicesCache, cacheKey, service);
  return service;
}

export interface SendSmsParams {
  to: string;
  text: string;
  centerName?: string;
  centerId?: string;
  scheduledDate?: string;
}

export interface SendAlimtalkParams {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
}

// SMS cost constants
export const SMS_COST = { sms: 28, lms: 55, mms: 120 };

function getMessageType(text: string): "sms" | "lms" {
  const byteLength = Buffer.byteLength(text, "utf-8");
  return byteLength > 90 ? "lms" : "sms";
}

function truncateToByteLimit(text: string, maxBytes: number): string {
  let result = "";
  let currentBytes = 0;
  for (const char of text) {
    const charBytes = Buffer.byteLength(char, "utf-8");
    if (currentBytes + charBytes > maxBytes) break;
    result += char;
    currentBytes += charBytes;
  }
  return result;
}

export async function sendSms(params: SendSmsParams): Promise<{ success: boolean; error?: string }> {
  if (!params.to) {
    console.error("[SOLAPI] SMS error: Phone number is required");
    return { success: false, error: "수신자 전화번호가 없습니다" };
  }
  
  const centers = await storage.getCenters();
  let center: any = null;
  let centerName = params.centerName || "DMC센터";

  if (params.centerId) {
    center = centers.find(c => c.id === params.centerId);
    if (center) centerName = center.name;
  } else {
    const matchingCenters = centers.filter(c => c.name === centerName);
    if (matchingCenters.length > 1) {
      console.warn(`[SOLAPI] WARNING: Multiple centers with name "${centerName}" (${matchingCenters.length}). Pass centerId for accuracy.`);
    }
    center = matchingCenters[0] || null;
  }

  const resolvedCenterId = params.centerId || center?.id;
  console.log(`[SOLAPI] sendSms called for center: ${centerName} (id=${resolvedCenterId || 'unknown'}), to: ${params.to.slice(0, 3)}****`);

  if (center && (center as any).smsMode === "credit") {
    return sendSmsCreditMode(center, params);
  }

  let creds: CenterCredentials | null = null;
  if (resolvedCenterId) {
    creds = await getCredentialsFromDb(resolvedCenterId);
  }
  if (!creds) {
    creds = await getCredentials(centerName);
  }
  if (!creds) {
    console.error(`[SOLAPI] No credentials available for ${centerName} (id=${resolvedCenterId})`);
    return { success: false, error: `SOLAPI not configured for ${centerName}` };
  }
  
  const cacheKey = `${resolvedCenterId || centerName}_${creds.apiKey.slice(-4)}`;
  const cached = getCachedValue(messageServicesCache, cacheKey);
  const service = cached || new SolapiMessageService(creds.apiKey, creds.apiSecret);
  if (!cached) setCachedValue(messageServicesCache, cacheKey, service);

  try {
    const phoneNumber = params.to.replace(/-/g, "");
    let text = params.text;
    const byteLength = Buffer.byteLength(text, "utf-8");
    if (byteLength > 2000) {
      text = truncateToByteLimit(text, 1990) + "\n...";
      console.log(`[SOLAPI] Text truncated from ${byteLength} to ${Buffer.byteLength(text, "utf-8")} bytes`);
    }
    const msgType = getMessageType(text);
    const sendParams: any = {
      to: phoneNumber,
      from: creds.senderNumber,
      text,
    };
    if (msgType === "lms") {
      sendParams.type = "LMS";
    }
    if (params.scheduledDate) {
      sendParams.scheduledDate = params.scheduledDate;
      console.log(`[SOLAPI] Scheduling ${msgType.toUpperCase()} for ${params.scheduledDate} to ${phoneNumber.slice(0, 3)}****`);
    } else {
      console.log(`[SOLAPI] Sending ${msgType.toUpperCase()} (${Buffer.byteLength(text, "utf-8")} bytes) to ${phoneNumber.slice(0, 3)}****`);
    }
    await service.sendOne(sendParams);
    return { success: true };
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString?.() || "Unknown error";
    const statusCode = error?.statusCode || error?.status || error?.response?.status;
    const errorBody = error?.response?.data || error?.body || error?.data;
    console.error(`[SOLAPI] SMS error for ${centerName}: ${errorMsg}`);
    if (statusCode) console.error(`[SOLAPI] Status code: ${statusCode}`);
    if (errorBody) console.error(`[SOLAPI] Error body:`, JSON.stringify(errorBody));
    if (errorMsg.includes("insufficient") || errorMsg.includes("balance") || errorMsg.includes("잔액")) {
      console.error(`[SOLAPI] ⚠️ Possible insufficient balance for ${centerName}`);
    }
    return { success: false, error: errorMsg };
  }
}

async function sendSmsCreditMode(center: any, params: SendSmsParams): Promise<{ success: boolean; error?: string }> {
  const senderNumber = center.creditSenderNumber;
  if (!senderNumber) {
    return { success: false, error: "발신번호가 설정되지 않았습니다. 설정에서 발신번호를 등록해주세요." };
  }

  const msgType = getMessageType(params.text);
  const cost = SMS_COST[msgType];

  const credit = await storage.getSmsCredit(center.id);
  const balance = credit?.balance || 0;
  if (balance < cost) {
    console.log(`[SOLAPI] Credit insufficient for ${center.name}: balance=${balance}, cost=${cost}`);
    return { success: false, error: `충전 금액이 부족합니다. (잔액: ${balance.toLocaleString()}원, 필요: ${cost}원)` };
  }

  const mokdongCreds = envCredentials["목동센터"];
  if (!mokdongCreds?.apiKey || !mokdongCreds?.apiSecret) {
    return { success: false, error: "시스템 문자 발송 설정이 되어 있지 않습니다." };
  }

  try {
    const service = new SolapiMessageService(mokdongCreds.apiKey, mokdongCreds.apiSecret);
    const phoneNumber = params.to.replace(/-/g, "");
    let text = params.text;
    const byteLength = Buffer.byteLength(text, "utf-8");
    if (byteLength > 2000) {
      text = truncateToByteLimit(text, 1990) + "\n...";
      console.log(`[SOLAPI] Credit mode: Text truncated from ${byteLength} to ${Buffer.byteLength(text, "utf-8")} bytes`);
    }
    const actualMsgType = getMessageType(text);
    const sendParams: any = {
      to: phoneNumber,
      from: senderNumber,
      text,
    };
    if (actualMsgType === "lms") {
      sendParams.type = "LMS";
    }
    if (params.scheduledDate) {
      sendParams.scheduledDate = params.scheduledDate;
      console.log(`[SOLAPI] Credit mode: Scheduling ${actualMsgType.toUpperCase()} for ${params.scheduledDate} to ${phoneNumber.slice(0, 3)}****`);
    } else {
      console.log(`[SOLAPI] Credit mode: Sending ${actualMsgType.toUpperCase()} (${Buffer.byteLength(text, "utf-8")} bytes) to ${phoneNumber.slice(0, 3)}****`);
    }
    await service.sendOne(sendParams);

    await storage.updateSmsCreditBalance(center.id, -cost);
    await storage.createSmsCreditTransaction({
      centerId: center.id,
      amount: -cost,
      type: "deduct",
      description: `${msgType.toUpperCase()} 발송 (${phoneNumber.slice(0, 3)}****)`,
      messageType: msgType,
    });

    const updatedCredit = await storage.getSmsCredit(center.id);
    const newBalance = updatedCredit?.balance || 0;

    if (newBalance <= LOW_BALANCE_THRESHOLD && updatedCredit?.lowBalanceNotifyEnabled !== false) {
      const last = lowBalanceNotifyAt.get(center.id) || 0;
      const now = Date.now();
      if (now - last >= LOW_BALANCE_COOLDOWN_MS) {
        lowBalanceNotifyAt.set(center.id, now);
        console.log(`[SOLAPI] Low credit balance for ${center.name}: ${newBalance}원 (알림 발송)`);
        try {
          const users = await storage.getUsers(center.id);
          const adminsAndPrincipals = users.filter((u: any) => u.role === 4 || u.role === 3);
          for (const admin of adminsAndPrincipals) {
            await storage.createNotification({
              userId: admin.id,
              title: "문자 크레딧 잔액 부족 - 충전 필요",
              message: `문자 크레딧 잔액이 ${newBalance.toLocaleString()}원 남았습니다. 잔액충전 메뉴(/sms-credit-charge)에서 바로 충전해주세요.`,
              type: "sms_credit_low",
            } as any);
          }
        } catch (e) {
          console.error(`[SOLAPI] Failed to send low balance notification:`, e);
        }
      } else {
        console.log(`[SOLAPI] Low credit balance for ${center.name}: ${newBalance}원 (쿨다운 중, 알림 생략)`);
      }
    }

    console.log(`[SOLAPI] Credit mode SMS sent for ${center.name}: type=${msgType}, cost=${cost}, remaining=${newBalance}`);
    return { success: true };
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString?.() || "Unknown error";
    console.error(`[SOLAPI] Credit mode SMS error for ${center.name}: ${errorMsg}`);
    if (errorMsg.includes("발신번호 미등록") || errorMsg.toLowerCase().includes("senderid")) {
      return {
        success: false,
        error: `발신번호(${senderNumber})가 문자 발송 시스템(SOLAPI)에 등록되어 있지 않습니다. 크레딧 모드에서는 시스템 SOLAPI 계정에 발신번호가 등록되어야 발송됩니다. 관리자에게 등록을 요청해주세요.`,
      };
    }
    return { success: false, error: errorMsg };
  }
}

// 크레딧 모드 발송에 사용되는 플랫폼 SOLAPI 계정에 등록된 발신번호 목록 조회
// 실패 시 null 반환 (검증 생략 처리용)
export async function getPlatformRegisteredSenderNumbers(): Promise<string[] | null> {
  const creds = envCredentials["목동센터"];
  if (!creds?.apiKey || !creds?.apiSecret) return null;
  try {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const signature = crypto
      .createHmac("sha256", creds.apiSecret)
      .update(date + salt)
      .digest("hex");
    const res = await fetch("https://api.solapi.com/senderid/v1/numbers/active", {
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${creds.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
    });
    if (!res.ok) {
      console.error(`[SOLAPI] Failed to fetch registered sender numbers: HTTP ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    let numbers: string[] = [];
    if (Array.isArray(data)) {
      numbers = data.map((n: any) => (typeof n === "string" ? n : n?.phoneNumber || n?.number || "")).filter(Boolean);
    } else if (Array.isArray(data?.numberList)) {
      numbers = data.numberList.map((n: any) => (typeof n === "string" ? n : n?.phoneNumber || n?.number || "")).filter(Boolean);
    } else if (Array.isArray(data?.list)) {
      numbers = data.list.map((n: any) => (typeof n === "string" ? n : n?.phoneNumber || n?.number || "")).filter(Boolean);
    }
    return numbers.map((n) => n.replace(/[^0-9]/g, ""));
  } catch (e: any) {
    console.error(`[SOLAPI] Error fetching registered sender numbers: ${e?.message || e}`);
    return null;
  }
}

// System notification SMS - always uses admin environment variable credentials (not DB)
export async function sendSystemSms(params: { to: string; text: string }): Promise<{ success: boolean; error?: string }> {
  const creds = getSystemCredentials();
  if (!creds) {
    console.error("[SOLAPI] System credentials not configured in environment variables");
    return { success: false, error: "System SOLAPI credentials not configured" };
  }
  
  try {
    const service = new SolapiMessageService(creds.apiKey, creds.apiSecret);
    const phoneNumber = params.to.replace(/[^0-9]/g, "");
    
    console.log(`[SOLAPI] Sending system SMS to ${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`);
    
    await service.sendOne({
      to: phoneNumber,
      from: creds.senderNumber,
      text: params.text,
    });
    
    console.log("[SOLAPI] System SMS sent successfully");
    return { success: true };
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString?.() || "Unknown error";
    console.error("[SOLAPI] System SMS error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function sendAttendanceNotification(
  studentName: string,
  checkInTime: Date,
  parentPhone: string,
  centerName?: string,
  customTemplate?: string,
  centerId?: string
): Promise<{ success: boolean; error?: string; sentText?: string }> {
  const timeStr = checkInTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  const dateStr = checkInTime.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
  
  let text = customTemplate || `[{학원명}] {학생명} 학생이 출석하였습니다.`;
  text = text.replace(/{학원명}/g, centerName || "학원");
  text = text.replace(/{학생명}/g, studentName);
  text = text.replace(/{시간}/g, timeStr);
  text = text.replace(/{날짜}/g, dateStr);
  
  const result = await sendSms({
    to: parentPhone,
    text,
    centerName,
    centerId,
  });
  return { ...result, sentText: text };
}

export async function sendLateNotification(
  studentName: string,
  _expectedTime: string,
  parentPhone: string,
  centerName?: string,
  customTemplate?: string,
  centerId?: string
): Promise<{ success: boolean; error?: string; sentText?: string }> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  const dateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });

  let text = customTemplate || `[{학원명}] {학생명} 학생이 수업에 참여하지 않았습니다. 빠르게 등원할 수 있도록 해주세요.`;
  text = text.replace(/{학원명}/g, centerName || "학원");
  text = text.replace(/{학생명}/g, studentName);
  text = text.replace(/{시간}/g, timeStr);
  text = text.replace(/{날짜}/g, dateStr);
  
  const result = await sendSms({
    to: parentPhone,
    text,
    centerName,
    centerId,
  });
  return { ...result, sentText: text };
}

export async function isSolapiConfigured(centerName?: string): Promise<boolean> {
  const centerKey = centerName || "DMC센터";

  // 크레딧 모드 센터는 자체 API 자격증명이 없어도, 시스템 자격증명 + 발신번호로 발송 가능
  try {
    const allCenters = await storage.getCenters();
    const matched = allCenters.filter(c => c.name === centerKey);
    for (const c of matched) {
      if ((c as any).smsMode === "credit") {
        const senderOk = !!(c as any).creditSenderNumber;
        const systemOk = !!getSystemCredentials();
        if (senderOk && systemOk) {
          return true;
        }
      }
    }
  } catch (e) {
    console.error("[SOLAPI] isSolapiConfigured: smsMode 확인 실패", e);
  }

  const creds = await getCredentials(centerKey);
  return !!(creds?.apiKey && creds?.apiSecret && creds?.senderNumber);
}

export async function sendSMS(
  centerId: string,
  to: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const centers = await storage.getCenters();
  const center = centers.find(c => c.id === centerId);
  if (!center) {
    return { success: false, error: "Center not found" };
  }
  
  return sendSms({
    to,
    text,
    centerName: center.name,
    centerId,
  });
}
