import { storage } from "../storage";
import { sendLateNotification, isSolapiConfigured } from "./solapi";

const DAY_MAP: Record<number, string> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};

function getKoreaTime(): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")),
    parseInt(get("month")) - 1,
    parseInt(get("day")),
    parseInt(get("hour")),
    parseInt(get("minute")),
    parseInt(get("second"))
  );
}

function getKoreaTodayStr(): string {
  const now = getKoreaTime();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function checkAutoLateNotifications() {
  try {
    const allCenters = await storage.getCenters();
    const koreaTime = getKoreaTime();
    const todayStr = getKoreaTodayStr();
    const todayDay = DAY_MAP[koreaTime.getDay()];
    const currentMinutes = koreaTime.getHours() * 60 + koreaTime.getMinutes();

    for (const center of allCenters) {
      try {
        const enabledSetting = await storage.getSystemSetting(`auto_late_notification_enabled_${center.id}`);
        if (enabledSetting !== "true") continue;

        const minutesSetting = await storage.getSystemSetting(`auto_late_notification_minutes_${center.id}`);
        const thresholdMinutes = parseInt(minutesSetting || "10", 10);

        const solapiOk = await isSolapiConfigured(center.name);
        if (!solapiOk) continue;

        const customTemplate = await storage.getSystemSetting(`auto_late_notification_template_${center.id}`);
        let lateTemplateBody: string | undefined;
        if (customTemplate && customTemplate.trim()) {
          lateTemplateBody = customTemplate;
        } else {
          const templates = await storage.getMessageTemplates(center.id);
          const lateTemplate = templates.find((t) => t.type === "late");
          lateTemplateBody = lateTemplate?.body;
        }

        const allClasses = await storage.getClasses(center.id);
        const activeClasses = allClasses.filter((c) => !c.isArchived);

        for (const cls of activeClasses) {
          let classStartTime: string | null = null;

          if (cls.schedule) {
            try {
              const scheduleSlots = JSON.parse(cls.schedule);
              const todaySlot = scheduleSlots.find((s: any) => s.day === todayDay);
              if (todaySlot) {
                classStartTime = todaySlot.startTime;
              }
            } catch {}
          }

          if (!classStartTime && cls.days.includes(todayDay)) {
            classStartTime = cls.startTime;
          }

          if (!classStartTime) continue;

          const classStartMinutes = timeToMinutes(classStartTime);
          const elapsedMinutes = currentMinutes - classStartMinutes;

          if (elapsedMinutes < thresholdMinutes || elapsedMinutes > 120) continue;

          const enrolledStudents = await storage.getClassStudents(cls.id);

          for (const student of enrolledStudents) {
            try {
              const existingRecord = await storage.getAttendanceRecordByStudentDateAndClass(
                student.id, todayStr, cls.id
              );

              if (existingRecord) continue;

              const allTodayRecords = await storage.getAttendanceRecordsByStudentAndDate(student.id, todayStr);
              const alreadyCheckedIn = allTodayRecords.some(r => !!r.checkInAt);
              if (alreadyCheckedIn) continue;

              const logKey = `auto_late_sent_${center.id}_${cls.id}_${student.id}_${todayStr}`;
              const alreadySent = await storage.getSystemSetting(logKey);
              if (alreadySent === "sent") continue;

              const parentPhone = student.motherPhone || student.fatherPhone;
              if (!parentPhone) continue;

              const result = await sendLateNotification(
                student.name,
                classStartTime,
                parentPhone,
                center.name,
                lateTemplateBody,
                center.id
              );

              if (result.success) {
                await storage.setSystemSetting(logKey, "sent");

                const record = await storage.createAttendanceRecord({
                  studentId: student.id,
                  centerId: center.id,
                  classId: cls.id,
                  attendanceStatus: "late",
                  checkInDate: todayStr,
                });

                await storage.createNotificationLog({
                  attendanceRecordId: record.id,
                  recipientPhone: parentPhone,
                  recipientType: student.motherPhone ? "mother" : "father",
                  messageType: "late",
                  channel: "sms",
                  status: "sent",
                  errorMessage: null,
                  messageContent: result.sentText || null,
                });

                console.log(`[AUTO-LATE] Sent to ${student.name} (${cls.name} ${cls.subject}반) at ${center.name}`);
              } else {
                console.error(`[AUTO-LATE] Failed for ${student.name}: ${result.error}`);
              }
            } catch (studentErr) {
              console.error(`[AUTO-LATE] Error processing student ${student.id}:`, studentErr);
            }
          }
        }
      } catch (centerErr) {
        console.error(`[AUTO-LATE] Error processing center ${center.id}:`, centerErr);
      }
    }
  } catch (error) {
    console.error("[AUTO-LATE] Check failed:", error);
  }
}

let autoLateInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoLateNotificationScheduler(intervalMinutes: number = 5) {
  if (autoLateInterval) {
    clearInterval(autoLateInterval);
  }

  console.log(`[AUTO-LATE] Scheduler started (every ${intervalMinutes} minutes)`);

  autoLateInterval = setInterval(() => {
    checkAutoLateNotifications().catch((err) => {
      console.error("[AUTO-LATE] Scheduler error:", err);
    });
  }, intervalMinutes * 60 * 1000);

  setTimeout(() => {
    checkAutoLateNotifications().catch((err) => {
      console.error("[AUTO-LATE] Initial check error:", err);
    });
  }, 30000);
}

export async function cleanupAutoLateLogs() {
  try {
    const todayStr = getKoreaTodayStr();

    const { db } = await import("../db");
    const { systemSettings } = await import("@shared/schema");
    const { like } = await import("drizzle-orm");

    const allKeys = await db.select({ key: systemSettings.key })
      .from(systemSettings)
      .where(like(systemSettings.key, "auto_late_sent_%"));

    const keysToDelete = allKeys
      .filter(row => !row.key.endsWith(todayStr))
      .map(row => row.key);

    if (keysToDelete.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(systemSettings)
        .where(inArray(systemSettings.key, keysToDelete));
    }
  } catch (error) {
    console.error("[AUTO-LATE] Cleanup error:", error);
  }
}
