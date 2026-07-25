import { storage } from "../storage";
import { sendSms } from "./solapi";

export interface BulkSmsResult {
  successCount: number;
  failCount: number;
  results: { studentId: string; success: boolean; error?: string }[];
}

/**
 * 선택된 학생들에게 문자를 발송하고 발송 내역을 기록한다.
 * 즉시 발송(/api/sms/bulk-send)과 예약 발송 스케줄러가 공통으로 사용한다.
 */
export async function sendBulkSmsToStudents(params: {
  studentIds: string[];
  message: string;
  selectedTypes: string[];
  actorId: string;
}): Promise<BulkSmsResult> {
  const { studentIds, message, selectedTypes, actorId } = params;
  const trimmed = message.trim();
  const results: BulkSmsResult["results"] = [];
  let successCount = 0;
  let failCount = 0;

  for (const studentId of studentIds) {
    const student = await storage.getUser(studentId);
    if (!student) {
      results.push({ studentId, success: false, error: "Student not found" });
      failCount++;
      continue;
    }

    const phoneTargets: { phone: string; type: string }[] = [];
    if (selectedTypes.includes("mother")) {
      if (student.motherPhone) phoneTargets.push({ phone: student.motherPhone, type: "mother" });
    }
    if (selectedTypes.includes("father")) {
      if (student.fatherPhone) phoneTargets.push({ phone: student.fatherPhone, type: "father" });
    }
    if (selectedTypes.includes("student")) {
      const usernameDigits = (student.username || "").replace(/\D/g, "");
      const usernameIsPhone = usernameDigits.length >= 9 && usernameDigits.length <= 11;
      const ownPhone = student.studentPhone || student.phone || (usernameIsPhone ? student.username : "");
      if (ownPhone) phoneTargets.push({ phone: ownPhone, type: "student" });
    }

    if (phoneTargets.length === 0) {
      results.push({ studentId, success: false, error: "No matching phone number for selected recipients" });
      failCount++;
      continue;
    }

    const studentCenters = await storage.getUserCenters(studentId);
    if (studentCenters.length === 0) {
      results.push({ studentId, success: false, error: "Student has no center" });
      failCount++;
      continue;
    }

    const center = studentCenters[0];

    let studentSuccess = false;
    for (const { phone, type: recipientType } of phoneTargets) {
      let smsResult: { success: boolean; error?: string };
      try {
        smsResult = await sendSms({
          to: phone,
          text: trimmed,
          centerName: center.name,
          centerId: center.id,
        });
      } catch (smsErr: any) {
        smsResult = { success: false, error: smsErr?.message || "발송 중 오류 발생" };
      }

      try {
        await storage.createSmsHistory({
          centerId: center.id,
          sentBy: actorId || "",
          studentId,
          recipientPhone: phone,
          recipientType,
          message: trimmed,
          status: smsResult.success ? "success" : "failed",
          errorMessage: smsResult.success ? undefined : (smsResult.error || "발송 실패"),
        });
      } catch (histErr) {
        console.error("[SMS-HISTORY] Failed to save history:", histErr);
      }

      if (smsResult.success) {
        studentSuccess = true;
      }
    }

    if (studentSuccess) {
      results.push({ studentId, success: true });
      successCount++;
    } else {
      results.push({ studentId, success: false, error: "SMS send failed" });
      failCount++;
    }
  }

  return { successCount, failCount, results };
}

let isProcessing = false;

/**
 * 예약 시간이 도래한 예약 문자를 발송 처리한다.
 */
export async function processScheduledSms(): Promise<void> {
  if (isProcessing) return; // 중복 실행 방지
  isProcessing = true;
  try {
    const due = await storage.getDueScheduledSms();
    for (const item of due) {
      // 원자적 클레임: 다른 실행/인스턴스가 이미 가져간 건은 건너뜀
      const claimed = await storage.claimScheduledSms(item.id);
      if (!claimed) continue;
      try {
        const { successCount, failCount } = await sendBulkSmsToStudents({
          studentIds: item.studentIds,
          message: item.message,
          selectedTypes: item.phoneTypes,
          actorId: item.createdBy,
        });
        await storage.updateScheduledSmsStatus(item.id, "sent", successCount, failCount);
        console.log(`[SCHEDULED-SMS] Sent ${item.id}: success=${successCount}, fail=${failCount}`);
      } catch (err: any) {
        console.error(`[SCHEDULED-SMS] Failed to process ${item.id}:`, err?.message || err);
        await storage.updateScheduledSmsStatus(item.id, "failed", 0, item.studentIds.length);
      }
    }
  } catch (err: any) {
    console.error("[SCHEDULED-SMS] processScheduledSms error:", err?.message || err);
  } finally {
    isProcessing = false;
  }
}

/**
 * 예약 문자 스케줄러 시작 (기본 1분 간격).
 */
export function startScheduledSmsScheduler(intervalMinutes = 1): void {
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(() => {
    processScheduledSms().catch(() => {});
  }, intervalMs);
  console.log(`[SCHEDULED-SMS] Scheduler started (interval: ${intervalMinutes}min)`);
}
