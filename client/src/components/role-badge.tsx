import { Badge } from "@/components/ui/badge";
import { UserRole } from "@shared/schema";

interface RoleBadgeProps {
  role: number;
  isClinicTeacher?: boolean;
  size?: "sm" | "default";
}

const roleConfig: Record<number, { label: string; className: string }> = {
  [UserRole.ADMIN]: {
    label: "관리자",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  [UserRole.PRINCIPAL]: {
    label: "원장",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  [UserRole.TEACHER]: {
    label: "선생님",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  [UserRole.STUDENT]: {
    label: "학생",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  [UserRole.PARENT]: {
    label: "학부모",
    className: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  },
  [UserRole.KIOSK]: {
    label: "출결 계정",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

const clinicTeacherConfig = {
  label: "클리닉 선생님",
  className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

export function RoleBadge({ role, isClinicTeacher = false, size = "default" }: RoleBadgeProps) {
  const config = isClinicTeacher && role === UserRole.TEACHER
    ? clinicTeacherConfig
    : roleConfig[role] || roleConfig[UserRole.STUDENT];

  return (
    <Badge
      variant="secondary"
      className={`${config.className} ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      data-testid={`badge-role-${role}`}
    >
      {config.label}
    </Badge>
  );
}
