import { storage } from "../storage";
import { sendSms, isSolapiConfigured } from "./solapi";
import { eq } from "drizzle-orm";

function getKoreaTomorrow(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const parts = formatter.formatToParts(tomorrow);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getKoreaTimeHHMM(): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const h = parts.find(p => p.type === "hour")?.value || "00";
  const m = parts.find(p => p.type === "minute")?.value || "00";
  return `${h}:${m}`;
}

async function processSupplementaryReminders(): Promise<void> {
  const tomorrowDate = getKoreaTomorrow();
  const nowHHMM = getKoreaTimeHHMM();

  try {
    const classes = await storage.getSupplementaryClassesForReminder(tomorrowDate);
    if (classes.length === 0) return;

    for (const cls of classes) {
      try {
        const classReminderTime = (cls as any).reminderTime || "18:00";
        const [rH, rM] = classReminderTime.split(":").map(Number);
        const [nH, nM] = nowHHMM.split(":").map(Number);
        const reminderMinutes = rH * 60 + rM;
        const nowMinutes = nH * 60 + nM;
        if (nowMinutes < reminderMinutes || nowMinutes > reminderMinutes + 30) continue;

        const center = await storage.getCenter(cls.centerId);
        if (!center) continue;

        const centerName = center.name;
        const configured = await isSolapiConfigured(centerName);
        if (!configured) continue;

        const students = await storage.getSupplementaryStudents(cls.id);
        const unsentStudents = students.filter(s => !s.reminderSmsSent);
        if (unsentStudents.length === 0) {
          await storage.updateSupplementaryClass(cls.id, { reminderSent: true });
          continue;
        }

        const teacher = await storage.getUser(cls.teacherId);
        const reasonText = cls.reason === "직접입력" ? cls.customReason : cls.reason;

        for (const entry of unsentStudents) {
          const student = await storage.getUser(entry.studentId);
          if (!student) continue;

          const phone = student.motherPhone || student.fatherPhone || student.phone;
          if (!phone) continue;

          let message: string;
          const reminderTemplate = (center as any).supplementaryReminderSmsTemplate;
          if (reminderTemplate) {
            message = reminderTemplate
              .replace(/\{학원명\}/g, centerName)
              .replace(/\{학생명\}/g, student.name)
              .replace(/\{날짜\}/g, tomorrowDate)
              .replace(/\{시작시간\}/g, cls.startTime)
              .replace(/\{종료시간\}/g, cls.endTime || "미정")
              .replace(/\{강의실\}/g, cls.classroom || "")
              .replace(/\{사유\}/g, reasonText || "")
              .replace(/\{선생님\}/g, teacher?.name || "");
          } else {
            message = `[${centerName}] 보충 수업 안내\n\n`;
            message += `학생: ${student.name}\n`;
            message += `날짜: 내일 (${tomorrowDate})\n`;
            message += `시간: ${cls.startTime} ~ ${cls.endTime || "미정"}\n`;
            if (cls.classroom) message += `강의실: ${cls.classroom}\n`;
            if (teacher) message += `선생님: ${teacher.name}\n`;
            if (reasonText) message += `사유: ${reasonText}\n`;
            message += `\n내일 보충 수업이 있습니다. 참석 부탁드립니다.`;
          }

          const result = await sendSms({ to: phone, text: message, centerName, centerId: cls.centerId });
          if (result.success) {
            await storage.updateSupplementaryStudent(entry.id, { reminderSmsSent: true });
          }

          const recipientType = phone === student.motherPhone ? "mother" : phone === student.fatherPhone ? "father" : "student";
          await storage.createSmsHistory({
            centerId: cls.centerId,
            sentBy: cls.teacherId,
            studentId: entry.studentId,
            recipientPhone: phone,
            recipientType,
            message,
            status: result.success ? "sent" : "failed",
            category: "supplementary",
            referenceId: cls.id,
          });
        }

        const updatedStudents = await storage.getSupplementaryStudents(cls.id);
        const allSent = updatedStudents.every(s => s.reminderSmsSent);
        if (allSent) {
          await storage.updateSupplementaryClass(cls.id, { reminderSent: true });
        }
      } catch (err) {
        console.error(`[SUPPLEMENTARY-REMINDER] Error processing class ${cls.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[SUPPLEMENTARY-REMINDER] Error:", err);
  }
}

let reminderInterval: NodeJS.Timeout | null = null;

export function startSupplementaryReminderScheduler(intervalMinutes: number = 10): void {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => {
    processSupplementaryReminders().catch(() => {});
  }, intervalMinutes * 60 * 1000);
  console.log(`[SUPPLEMENTARY-REMINDER] Scheduler started (every ${intervalMinutes} minutes)`);
}
