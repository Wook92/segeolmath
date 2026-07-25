export const schemaSql = `
CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

CREATE TABLE IF NOT EXISTS "assessments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "score" integer NOT NULL,
        "max_score" integer DEFAULT 100 NOT NULL,
        "assessment_date" date NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attendance_pins" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "pin" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "teacher_check_in_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "check_in_code" text NOT NULL,
        "sms_recipient_1" text,
        "sms_recipient_2" text,
        "message_template" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attendance_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "class_id" varchar,
        "check_in_at" timestamp DEFAULT now() NOT NULL,
        "check_in_date" date NOT NULL,
        "was_late" boolean DEFAULT false NOT NULL,
        "late_notification_sent" boolean DEFAULT false NOT NULL,
        "late_notification_sent_at" timestamp,
        "check_in_notification_sent" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_work_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "work_date" date NOT NULL,
        "check_in_at" timestamp,
        "check_out_at" timestamp,
        "work_minutes" integer,
        "no_check_out" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "centers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "business_name" text,
        "representative_name" text,
        "business_registration_number" text,
        "business_address" text,
        "business_phone" text,
        "logo_url" text,
        "login_logo_url" text,
        "sidebar_logo_url" text,
        "favicon_url" text,
        "attendance_pad_logo_url" text,
        "shortcut_icon_url" text,
        "domain" text,
        "clinic_teacher_enabled" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "class_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "class_videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "title" text NOT NULL,
        "youtube_url" text NOT NULL,
        "thumbnail_url" text,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "classes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "subject" text NOT NULL,
        "class_type" text DEFAULT 'regular' NOT NULL,
        "teacher_id" varchar,
        "teacher_name" text,
        "center_id" varchar NOT NULL,
        "classroom" text,
        "days" text[] NOT NULL,
        "start_time" text NOT NULL,
        "end_time" text NOT NULL,
        "schedule" text,
        "color" text DEFAULT '#3B82F6' NOT NULL,
        "is_archived" boolean DEFAULT false NOT NULL,
        "base_fee" integer DEFAULT 0 NOT NULL,
        "additional_fee" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinic_assignment_files" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "step_id" varchar,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "file_type" text NOT NULL,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_assignment_steps" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "step_order" integer NOT NULL,
        "instruction" text NOT NULL,
        "is_completed" boolean DEFAULT false NOT NULL,
        "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "clinic_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "regular_teacher_id" varchar NOT NULL,
        "clinic_teacher_id" varchar,
        "center_id" varchar NOT NULL,
        "assignment_date" date NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_comments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "author_id" varchar NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_daily_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_progress_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "log_date" date NOT NULL,
        "problems_solved" text,
        "stopped_at" text,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_by" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinic_resources" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "class_id" varchar,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "description" text,
        "is_permanent" boolean DEFAULT false NOT NULL,
        "week_start_date" date,
        "uploaded_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);
ALTER TABLE "clinic_resources" ADD COLUMN IF NOT EXISTS "class_id" varchar;

CREATE TABLE IF NOT EXISTS "clinic_students" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "regular_teacher_id" varchar NOT NULL,
        "clinic_teacher_id" varchar,
        "center_id" varchar NOT NULL,
        "clinic_type" text DEFAULT 'middle' NOT NULL,
        "grade" text,
        "class_group" text,
        "clinic_days" text[] NOT NULL,
        "clinic_time" text,
        "default_instructions" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_instruction_defaults" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "weekday" text NOT NULL,
        "period1_default" text,
        "period2_default" text,
        "period3_default" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_weekly_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "week_start_date" date NOT NULL,
        "file_path" text,
        "file_name" text,
        "additional_notes" text,
        "clinic_teacher_feedback" text,
        "progress_notes" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "clinic_day_time_note" text,
        "weekly_evaluation" text,
        "period2_instruction" text,
        "period3_instruction" text,
        "clinic_teacher_notes" text,
        "use_default_period2" boolean DEFAULT true NOT NULL,
        "use_default_period3" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_weekly_record_files" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "record_id" varchar NOT NULL,
        "period" text NOT NULL,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "file_type" text NOT NULL,
        "file_size" integer,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_shared_instruction_groups" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "week_start_date" date NOT NULL,
        "period" text NOT NULL,
        "content" text,
        "use_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_shared_instruction_members" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "shared_group_id" varchar NOT NULL,
        "record_id" varchar NOT NULL,
        "joined_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "enrollments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "class_id" varchar NOT NULL,
        "enrolled_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "homework" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar,
        "title" text NOT NULL,
        "due_date" date NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "homework_submissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "homework_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "photos" text[],
        "completion_rate" integer DEFAULT 0,
        "status" text DEFAULT 'pending' NOT NULL,
        "feedback" text,
        "resubmit_reason" text,
        "submitted_at" timestamp,
        "reviewed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "face_to_face_checks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar,
        "title" text NOT NULL,
        "description" text,
        "due_date" date NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "face_to_face_check_results" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "check_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "completion_rate" integer DEFAULT 0,
        "status" text DEFAULT 'pending' NOT NULL,
        "feedback" text,
        "recheck_reason" text,
        "checked_at" timestamp,
        "checked_by" varchar
);

CREATE TABLE IF NOT EXISTS "message_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "attendance_record_id" varchar,
        "template_id" varchar,
        "recipient_phone" text NOT NULL,
        "recipient_type" text NOT NULL,
        "message_type" text NOT NULL,
        "channel" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "error_message" text,
        "message_content" text,
        "sent_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "message_content" text;

CREATE TABLE IF NOT EXISTS "notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "related_id" varchar,
        "related_type" text,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "solapi_credentials" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "api_key" text NOT NULL,
        "api_secret" text NOT NULL,
        "sender_number" text NOT NULL,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "solapi_credentials_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "student_class_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "attitude_score" integer,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "student_monthly_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "created_by_id" varchar NOT NULL,
        "year" integer NOT NULL,
        "month" integer NOT NULL,
        "report_content" text NOT NULL,
        "custom_instructions" text,
        "assessment_summary" text,
        "attendance_summary" text,
        "homework_summary" text,
        "clinic_summary" text,
        "video_viewing_summary" text,
        "study_cafe_summary" text,
        "sms_sent_at" timestamp,
        "sms_recipients" text,
        "sms_status" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_fixed_seats" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "seat_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "assigned_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_reservations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "seat_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "start_at" timestamp NOT NULL,
        "end_at" timestamp NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_seats" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "seat_number" integer NOT NULL,
        "row" integer NOT NULL,
        "col" integer NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_cafe_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "is_enabled" boolean DEFAULT false NOT NULL,
        "notice" text,
        "entry_password" text,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "study_cafe_settings_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" varchar PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "textbook_videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "textbook_id" varchar NOT NULL,
        "page_number" integer NOT NULL,
        "problem_number" integer NOT NULL,
        "youtube_url" text NOT NULL,
        "uploaded_by" varchar NOT NULL,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "textbooks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "title" text NOT NULL,
        "cover_image" text,
        "is_visible" boolean DEFAULT true NOT NULL
);

ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "center_id" varchar;

-- [2026-02-20] Migrate existing textbooks with empty center_id to first available center
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM textbooks WHERE center_id IS NULL OR center_id = '') THEN
    UPDATE textbooks SET center_id = (SELECT id FROM centers ORDER BY name LIMIT 1)
    WHERE center_id IS NULL OR center_id = '';
  END IF;
END $$;

-- [2026-02-20] Remove deprecated "교재 관리" feature (merged into "교재 영상")
DELETE FROM features WHERE menu_key = 'textbooks' AND name = '교재 관리';

CREATE TABLE IF NOT EXISTS "todo_assignees" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "todo_id" varchar NOT NULL,
        "assignee_id" varchar NOT NULL,
        "is_completed" boolean DEFAULT false NOT NULL,
        "completed_at" timestamp,
        "completed_for_date" date
);

CREATE TABLE IF NOT EXISTS "todos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "creator_id" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "start_date" date,
        "due_date" date NOT NULL,
        "priority" text DEFAULT 'medium' NOT NULL,
        "recurrence" text DEFAULT 'none' NOT NULL,
        "recurrence_anchor_date" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tuition_access_passwords" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "password" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "tuition_access_passwords_student_id_unique" UNIQUE("student_id")
);

CREATE TABLE IF NOT EXISTS "tuition_guidances" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "guidance_text" text,
        "image_urls" text[] DEFAULT '{}',
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "tuition_guidances_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "tuition_notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "parent_id" varchar,
        "center_id" varchar NOT NULL,
        "sent_by_id" varchar NOT NULL,
        "calculated_total" integer NOT NULL,
        "sent_amount" integer NOT NULL,
        "fee_breakdown" text,
        "payment_method" text NOT NULL,
        "payment_details" text,
        "message_content" text NOT NULL,
        "recipient_phone" text NOT NULL,
        "recipient_type" text,
        "status" text DEFAULT 'sent' NOT NULL,
        "error_message" text,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_centers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "center_id" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "mother_phone" text,
        "father_phone" text,
        "school" text,
        "grade" text,
        "role" integer DEFAULT 1 NOT NULL,
        "is_clinic_teacher" boolean DEFAULT false NOT NULL,
        "linked_student_ids" text[],
        "homeroom_teacher_id" varchar,
        "chat_password" text,
        "consent_agreed_at" timestamp,
        "consultation_image_url" text,
        "consultation_notes" text,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "conversations" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "conversation_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk'
  ) THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" 
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- Migration: Add missing columns to existing tables
-- These ALTER statements ensure production tables have all required columns

-- classes table: add is_archived, base_fee, additional_fee, assistant_teacher_id
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "base_fee" integer DEFAULT 0 NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "additional_fee" integer DEFAULT 0 NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "assistant_teacher_id" varchar;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "assistant_teacher_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "hourly_rate" integer;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
-- 기존 단일 부담임 데이터를 다중 부담임 배열로 백필 (이미 포함된 경우 제외)
UPDATE "classes" SET "assistant_teacher_ids" = ARRAY["assistant_teacher_id"]
  WHERE "assistant_teacher_id" IS NOT NULL
    AND ("assistant_teacher_ids" IS NULL OR array_length("assistant_teacher_ids", 1) IS NULL);

-- homework_submissions table: add status, completion_rate
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "completion_rate" integer DEFAULT 0;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "feedback" text;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "resubmit_reason" text;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;

-- notifications table: add is_read
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_id" varchar;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_type" text;

-- homework table: add student_id for individual assignments
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "student_id" varchar;

-- attendance_records table: add notification columns
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_notification_sent_at" timestamp;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_at" timestamp;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "attendance_status" text DEFAULT 'pending' NOT NULL;

-- clinic_students table: add clinic_type and clinic_time columns for high school vs middle school clinics
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "clinic_type" text DEFAULT 'middle' NOT NULL;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "clinic_time" text;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "grade" text;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "class_group" text;

-- clinic_instruction_defaults table: add period1_default column
ALTER TABLE "clinic_instruction_defaults" ADD COLUMN IF NOT EXISTS "period1_default" text;

-- student_class_notes table: add attitude_score column for class attitude evaluation (0-10)
ALTER TABLE "student_class_notes" ADD COLUMN IF NOT EXISTS "attitude_score" integer;

-- clinic_weekly_records table: add new columns for enhanced functionality
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "clinic_day_time_note" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "weekly_evaluation" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "period2_instruction" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "period3_instruction" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "clinic_teacher_notes" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period2" boolean DEFAULT true NOT NULL;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period3" boolean DEFAULT true NOT NULL;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period1" boolean DEFAULT true NOT NULL;

-- Student Exit Records (학생 퇴원 기록)
CREATE TABLE IF NOT EXISTS "student_exit_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "student_name" text NOT NULL,
        "center_id" varchar NOT NULL,
        "exit_month" text NOT NULL,
        "reasons" text[] NOT NULL,
        "notes" text,
        "recorded_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Monthly Student Snapshots (월별 학생 수 스냅샷)
CREATE TABLE IF NOT EXISTS "monthly_student_snapshots" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "month" text NOT NULL,
        "student_count" integer NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Monthly Finance Snapshots (월별 재무 계산 스냅샷 - 지난달 인건비 동결용)
CREATE TABLE IF NOT EXISTS "monthly_finance_snapshots" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "year_month" text NOT NULL,
        "kind" text NOT NULL,
        "data" text NOT NULL,
        "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_finance_snapshots_center_month_kind_idx" ON "monthly_finance_snapshots" ("center_id", "year_month", "kind");

-- Student Textbook Purchases (학생 교재비)
CREATE TABLE IF NOT EXISTS "class_textbooks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "price" integer DEFAULT 0 NOT NULL,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "student_textbook_purchases" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "textbook_name" varchar NOT NULL,
        "price" integer DEFAULT 0 NOT NULL,
        "purchase_date" timestamp DEFAULT now(),
        "notes" text,
        "class_textbook_id" varchar,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);
ALTER TABLE "student_textbook_purchases" ADD COLUMN IF NOT EXISTS "class_textbook_id" varchar;

-- Marketing Campaigns (마케팅 캠페인)
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "name" text NOT NULL,
        "channel" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "budget" integer NOT NULL,
        "notes" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Monthly Financial Records (월별 재무 기록)
CREATE TABLE IF NOT EXISTS "monthly_financial_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "year_month" text NOT NULL,
        "revenue_tuition" integer DEFAULT 0 NOT NULL,
        "revenue_tuition_details" text,
        "expense_regular_salary" integer DEFAULT 0 NOT NULL,
        "expense_regular_salary_details" text,
        "expense_part_time_salary" integer DEFAULT 0 NOT NULL,
        "expense_part_time_salary_details" text,
        "expense_hourly_salary" integer DEFAULT 0 NOT NULL,
        "expense_hourly_salary_details" text,
        "expense_employee_insurance" integer DEFAULT 0 NOT NULL,
        "expense_employee_insurance_details" text,
        "expense_rent" integer DEFAULT 0 NOT NULL,
        "expense_rent_details" text,
        "expense_utilities" integer DEFAULT 0 NOT NULL,
        "expense_utilities_details" text,
        "expense_internet" integer DEFAULT 0 NOT NULL,
        "expense_internet_details" text,
        "expense_insurance" integer DEFAULT 0 NOT NULL,
        "expense_insurance_details" text,
        "expense_depreciation" integer DEFAULT 0 NOT NULL,
        "expense_depreciation_details" text,
        "expense_marketing" integer DEFAULT 0 NOT NULL,
        "expense_marketing_details" text,
        "expense_office_supplies" integer DEFAULT 0 NOT NULL,
        "expense_office_supplies_details" text,
        "expense_teaching_materials" integer DEFAULT 0 NOT NULL,
        "expense_teaching_materials_details" text,
        "expense_maintenance" integer DEFAULT 0 NOT NULL,
        "expense_maintenance_details" text,
        "expense_meals" integer DEFAULT 0 NOT NULL,
        "expense_meals_details" text,
        "expense_other" integer DEFAULT 0 NOT NULL,
        "expense_other_details" text,
        "notes" text,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

-- Monthly Financial Records - additional expense columns
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_welfare" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_welfare_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_communication" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_communication_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_supplies" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_supplies_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_advertising" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_advertising_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_fees" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_fees_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_vehicle" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_vehicle_details" text;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_education" integer DEFAULT 0 NOT NULL;
ALTER TABLE "monthly_financial_records" ADD COLUMN IF NOT EXISTS "expense_education_details" text;

-- Teacher Salary Settings (선생님 급여 설정)
CREATE TABLE IF NOT EXISTS "teacher_salary_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "base_salary" integer DEFAULT 0 NOT NULL,
        "class_base_pay" integer DEFAULT 0 NOT NULL,
        "class_base_pay_middle" integer DEFAULT 0 NOT NULL,
        "class_base_pay_high" integer DEFAULT 0 NOT NULL,
        "student_threshold" integer DEFAULT 0 NOT NULL,
        "student_threshold_middle" integer DEFAULT 0 NOT NULL,
        "student_threshold_high" integer DEFAULT 0 NOT NULL,
        "per_student_bonus" integer DEFAULT 0 NOT NULL,
        "per_student_bonus_middle" integer DEFAULT 0 NOT NULL,
        "per_student_bonus_high" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_center_unique" ON "teacher_salary_settings" ("teacher_id", "center_id");

ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "class_base_pay_elementary" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "student_threshold_elementary" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "per_student_bonus_elementary" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "class_base_pay_adult" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "student_threshold_adult" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "per_student_bonus_adult" integer DEFAULT 0 NOT NULL;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "employment_type" text;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "wage_type" text;
ALTER TABLE "teacher_salary_settings" ADD COLUMN IF NOT EXISTS "hourly_rate" integer;

-- Teacher Salary Adjustments (급여 조정 항목)
CREATE TABLE IF NOT EXISTS "teacher_salary_adjustments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "year_month" varchar(7) NOT NULL,
        "amount" integer NOT NULL,
        "description" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "created_by" varchar
);

-- Add missing columns to users table (선생님 고용 형태, 일급, 시급)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_rate" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hourly_rate" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wage_type" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fixed_work_start" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fixed_work_end" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fixed_work_days" text[];
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "chat_password" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_agreed_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consultation_image_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consultation_notes" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_id" varchar;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "enrollment_date" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tuition_visible_to_student" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tuition_memo" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "custom_tuition_amount" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discount_rate" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discount_reason" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discount_target" text;

-- Add missing column to classes table (수업 레벨: 중등/고등)
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "class_level" text DEFAULT 'middle' NOT NULL;

-- Academy Calendar Events (학원 캘린더 이벤트)
CREATE TABLE IF NOT EXISTS "academy_calendar_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "event_type" text DEFAULT 'single' NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "color" text DEFAULT '#3B82F6' NOT NULL,
        "school" text,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

-- Exam Subject Schedules (시험 과목 일정)
CREATE TABLE IF NOT EXISTS "exam_subject_schedules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "event_id" varchar NOT NULL,
        "exam_date" date NOT NULL,
        "subjects" text NOT NULL,
        "grade" text,
        "excluded_student_ids" text[] DEFAULT ARRAY[]::text[],
        "created_at" timestamp DEFAULT now()
);

-- 시험 학교/학년/보강 명단 제외 컬럼 (기존 배포 호환)
ALTER TABLE "academy_calendar_events" ADD COLUMN IF NOT EXISTS "school" text;
ALTER TABLE "exam_subject_schedules" ADD COLUMN IF NOT EXISTS "grade" text;
ALTER TABLE "exam_subject_schedules" ADD COLUMN IF NOT EXISTS "excluded_student_ids" text[] DEFAULT ARRAY[]::text[];

-- Add payment tracking columns to tuition_notifications
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "textbook_total" integer DEFAULT 0;
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;

-- Add Toss Payments integration columns to tuition_notifications
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "toss_payment_key" text;
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "toss_order_id" text;

-- Fix: Mark Toss online payments correctly (toss_payment_key or toss_order_id present but payment_method is wrong)
UPDATE "tuition_notifications" SET payment_method = 'online' WHERE (toss_payment_key IS NOT NULL AND toss_payment_key != '') AND (payment_method IS NULL OR payment_method = '' OR payment_method = 'in_person');
UPDATE "tuition_notifications" SET payment_method = 'online' WHERE (toss_order_id IS NOT NULL AND toss_order_id != '') AND payment_status = 'paid' AND (payment_method IS NULL OR payment_method = '' OR payment_method = 'in_person');

-- Data repair (2026-05-01): A previous "one-time fix" migration was running on every
-- server startup and incorrectly transferred paid status from the original paid record
-- to the latest pending sibling, copying the original paid_at timestamp. This produced
-- rows where paid_at < created_at (chronologically impossible) and tangled up the
-- 결제완료/취소된 결제 status across multiple billing months for the same student.
-- The original migration is removed; this repair restores the correct state.
--
-- Step 1: For each chronologically-impossible paid row (paid_at < created_at), find
-- the closest cancelled sibling (same student/center/amount, created before the bad
-- paid_at) and restore it to paid using the original Toss keys and paid_at.
WITH bad_paid AS (
  SELECT id, student_id, center_id, paid_at, payment_method,
         toss_payment_key, toss_order_id,
         COALESCE(sent_amount, 0) + COALESCE(textbook_total, 0) AS amount
  FROM tuition_notifications
  WHERE payment_status = 'paid'
    AND paid_at IS NOT NULL
    AND created_at IS NOT NULL
    AND paid_at < created_at
),
match_orig AS (
  -- For each bad row, pick the closest cancelled sibling whose created_at is in the
  -- same KST month as the bad paid_at (the original record was created in the month
  -- it was paid). Use ROW_NUMBER on both sides so the same cancelled row can never
  -- be claimed by two different bad rows (avoids non-deterministic restore).
  SELECT orig_id, restored_paid_at, restored_method, restored_toss_key, restored_toss_order
  FROM (
    SELECT
      b.id AS bad_id,
      c.id AS orig_id,
      b.paid_at AS restored_paid_at,
      b.payment_method AS restored_method,
      b.toss_payment_key AS restored_toss_key,
      b.toss_order_id AS restored_toss_order,
      ROW_NUMBER() OVER (
        PARTITION BY b.id
        ORDER BY ABS(EXTRACT(EPOCH FROM (b.paid_at - c.created_at)))
      ) AS rn_per_bad,
      ROW_NUMBER() OVER (
        PARTITION BY c.id
        ORDER BY ABS(EXTRACT(EPOCH FROM (b.paid_at - c.created_at)))
      ) AS rn_per_orig
    FROM bad_paid b
    JOIN tuition_notifications c
      ON c.student_id = b.student_id
     AND COALESCE(c.center_id::text, '') = COALESCE(b.center_id::text, '')
     AND COALESCE(c.sent_amount, 0) + COALESCE(c.textbook_total, 0) = b.amount
     AND c.payment_status = 'cancelled'
     AND c.id != b.id
     AND c.created_at IS NOT NULL
     AND c.created_at <= b.paid_at
     AND to_char(c.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')
         = to_char(b.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')
  ) ranked
  WHERE rn_per_bad = 1 AND rn_per_orig = 1
)
UPDATE tuition_notifications n
SET
  payment_status = 'paid',
  paid_at = m.restored_paid_at,
  payment_method = COALESCE(NULLIF(m.restored_method, ''), 'online'),
  toss_payment_key = m.restored_toss_key,
  toss_order_id = m.restored_toss_order
FROM match_orig m
WHERE n.id = m.orig_id;

-- Step 2: Reset every chronologically-impossible paid row back to pending so the
-- bad state is cleared (whether or not we found and restored an original sibling).
UPDATE tuition_notifications
SET
  payment_status = 'pending',
  paid_at = NULL,
  toss_payment_key = NULL,
  toss_order_id = NULL,
  payment_method = 'in_person'
WHERE payment_status = 'paid'
  AND paid_at IS NOT NULL
  AND created_at IS NOT NULL
  AND paid_at < created_at;

-- Add title column to tuition_notifications (결제 내역 제목)
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "title" text;

-- Add payment memo column to tuition_notifications
ALTER TABLE "tuition_notifications" ADD COLUMN IF NOT EXISTS "payment_memo" text;

-- Add business info columns to centers
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "business_name" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "representative_name" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "business_registration_number" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "business_address" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "business_phone" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "login_logo_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "sidebar_logo_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "favicon_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "attendance_pad_logo_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "shortcut_icon_url" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "domain" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "clinic_teacher_enabled" boolean DEFAULT false;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

-- Feature Management Tables
CREATE TABLE IF NOT EXISTS "features" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "image_url" text,
        "menu_key" text NOT NULL,
        "parent_menu_key" text,
        "feature_type" text DEFAULT 'optional' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "display_order" integer DEFAULT 0 NOT NULL,
        "purchase_price" integer DEFAULT 0,
        "subscription_price" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "purchase_price" integer DEFAULT 0;
ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "subscription_price" integer DEFAULT 0;
ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "video_url" text;

CREATE TABLE IF NOT EXISTS "feature_requests" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "feature_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "requested_by" varchar NOT NULL,
        "phone_number" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "request_note" text,
        "response_note" text,
        "responded_by" varchar,
        "responded_at" timestamp,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "center_features" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "feature_id" varchar NOT NULL,
        "is_hidden" boolean DEFAULT false NOT NULL,
        "enabled_at" timestamp DEFAULT now(),
        "enabled_by" varchar
);

ALTER TABLE "center_features" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "feature_suggestions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "requested_by" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "admin_note" text,
        "responded_by" varchar,
        "responded_at" timestamp,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sms_history" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "sent_by" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "recipient_phone" text NOT NULL,
        "recipient_type" text NOT NULL,
        "message" text NOT NULL,
        "status" text DEFAULT 'sent' NOT NULL,
        "sent_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "scheduled_sms_messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "created_by" varchar NOT NULL,
        "student_ids" text[] NOT NULL,
        "message" text NOT NULL,
        "phone_types" text[] NOT NULL,
        "scheduled_at" timestamp NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "success_count" integer,
        "fail_count" integer,
        "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_sms_status_time" 
ON "scheduled_sms_messages" ("status", "scheduled_at");

CREATE TABLE IF NOT EXISTS "sms_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_menu_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "menu_order" text NOT NULL,
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_activity_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "page_path" text NOT NULL,
        "session_id" varchar NOT NULL,
        "visited_at" timestamp DEFAULT now(),
        "duration_seconds" integer
);

CREATE TABLE IF NOT EXISTS "feature_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "menu_key" text NOT NULL UNIQUE,
        "description" text,
        "display_order" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "category_id" varchar;

-- Insert default feature categories
INSERT INTO "feature_categories" ("id", "name", "menu_key", "description", "display_order", "is_active")
VALUES 
  ('cat-class-mgmt', '수업 관리', 'class-management', '수업 관련 기능들', 1, true),
  ('cat-schedule', '선생님', 'schedule', '선생님 관련 기능들', 2, true),
  ('cat-parent', '학부모', 'parent-portal', '학부모 관련 기능들', 3, true)
ON CONFLICT ("id") DO NOTHING;

UPDATE feature_categories SET name = '선생님', description = '선생님 관련 기능들' WHERE id = 'cat-schedule' AND name = '일정';
UPDATE features SET name = '업무관리', description = '선생님들에게 업무를 지시하고 관리하는 기본 기능입니다.' WHERE menu_key = 'todos' AND name = '일정공유';
UPDATE features SET name = '업무관리' WHERE menu_key = 'todos' AND name = '업무지시';

CREATE TABLE IF NOT EXISTS "deleted_objects" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "object_key" text NOT NULL,
        "object_type" text NOT NULL,
        "center_id" varchar,
        "deleted_at" timestamp DEFAULT now(),
        "scheduled_delete_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "center_registrations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "business_name" text,
        "representative_name" text,
        "business_registration_number" text,
        "business_address" text,
        "business_phone" text,
        "applicant_name" text NOT NULL,
        "applicant_phone" text NOT NULL,
        "applicant_email" text,
        "login_logo_url" text,
        "sidebar_logo_url" text,
        "favicon_url" text,
        "attendance_pad_logo_url" text,
        "shortcut_icon_url" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "reject_reason" text,
        "created_at" timestamp DEFAULT now(),
        "reviewed_at" timestamp,
        "reviewed_by" varchar
);

ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "login_logo_url" text;
ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "sidebar_logo_url" text;
ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "favicon_url" text;
ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "attendance_pad_logo_url" text;
ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "shortcut_icon_url" text;
ALTER TABLE "center_registrations" ADD COLUMN IF NOT EXISTS "toss_consent_agreed" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS "logo_help_images" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "logo_type" text NOT NULL UNIQUE,
        "image_url" text NOT NULL,
        "description" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "solapi_manuals" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "manual_type" text NOT NULL UNIQUE,
        "title" text NOT NULL,
        "link_url" text,
        "image_url" text,
        "description" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "student_presentation_videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "class_id" varchar NOT NULL,
        "center_id" varchar NOT NULL,
        "title" text NOT NULL,
        "youtube_url" text NOT NULL,
        "description" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "exams" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "class_id" varchar,
        "name" text NOT NULL,
        "scope" text,
        "exam_date" date NOT NULL,
        "max_score" integer DEFAULT 100 NOT NULL,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "exam_participants" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "exam_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "score" integer,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "exam_papers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "exam_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "object_key" text NOT NULL,
        "image_url" text NOT NULL,
        "uploaded_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "google_calendar_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL UNIQUE,
        "access_token" text NOT NULL,
        "refresh_token" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "calendar_id" text DEFAULT 'primary',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_calendar_class_students" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "event_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_calendar_event_colors" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "event_id" varchar NOT NULL,
        "color_index" integer NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_calendar_event_teachers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "event_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "teacher_student_messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "sender_id" varchar NOT NULL,
        "receiver_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "content" text NOT NULL,
        "image_url" text,
        "image_object_key" text,
        "is_read" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);

ALTER TABLE "teacher_student_messages" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "teacher_student_messages" ADD COLUMN IF NOT EXISTS "image_object_key" text;

CREATE INDEX IF NOT EXISTS "idx_teacher_student_messages_center_teacher_student" 
ON "teacher_student_messages" ("center_id", "teacher_id", "student_id");

CREATE INDEX IF NOT EXISTS "idx_teacher_student_messages_created_at" 
ON "teacher_student_messages" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "daily_notices" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "notice_date" date NOT NULL,
        "additional_note" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_daily_notices_center_student_date" 
ON "daily_notices" ("center_id", "student_id", "notice_date");

CREATE TABLE IF NOT EXISTS "sms_setup_guide_steps" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "step_number" integer NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "image_url" text,
        "link_url" text,
        "link_text" text,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bug_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "reporter_id" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "admin_note" text,
        "resolved_at" timestamp,
        "resolved_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "toss_client_key" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "toss_secret_key" text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "student_phone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "withdrawn_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "withdrawn_enrollments" text;

CREATE TABLE IF NOT EXISTS "new_consultations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "student_name" text NOT NULL,
        "gender" text,
        "school" text,
        "grade" text,
        "target_school" text,
        "student_phone" text,
        "parent_phone" text,
        "available_days" text,
        "scores" text,
        "counseling_content" text,
        "consultation_date" text,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
ALTER TABLE "new_consultations" ADD COLUMN IF NOT EXISTS "available_days" text;
ALTER TABLE "new_consultations" ADD COLUMN IF NOT EXISTS "student_phone" text;
ALTER TABLE "new_consultations" ADD COLUMN IF NOT EXISTS "parent_phone" text;
ALTER TABLE "new_consultations" ADD COLUMN IF NOT EXISTS "consultation_date" text;

CREATE TABLE IF NOT EXISTS "video_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "class_id" varchar NOT NULL,
        "title" text NOT NULL,
        "room_name" text NOT NULL,
        "host_id" varchar NOT NULL,
        "status" text DEFAULT 'scheduled' NOT NULL,
        "scheduled_at" timestamp,
        "started_at" timestamp,
        "ended_at" timestamp,
        "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_video_sessions_center_status" 
ON "video_sessions" ("center_id", "status");

CREATE TABLE IF NOT EXISTS "video_session_participants" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "joined_at" timestamp,
        "left_at" timestamp,
        "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_video_session_participants_session" 
ON "video_session_participants" ("session_id");

CREATE INDEX IF NOT EXISTS "idx_video_session_participants_student" 
ON "video_session_participants" ("student_id");

CREATE TABLE IF NOT EXISTS "semester_announcements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "status" text DEFAULT 'draft' NOT NULL,
        "created_by_id" varchar NOT NULL,
        "published_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "semester_announcement_classes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "announcement_id" varchar NOT NULL,
        "name" text NOT NULL,
        "subject" text NOT NULL,
        "class_level" text DEFAULT 'middle' NOT NULL,
        "teacher_name" text,
        "classroom" text,
        "days" text[] NOT NULL,
        "start_time" text NOT NULL,
        "end_time" text NOT NULL,
        "schedule" text,
        "color" text DEFAULT '#3B82F6' NOT NULL,
        "textbook" text,
        "notes" text,
        "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "semester_recommendations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "announcement_id" varchar NOT NULL,
        "announcement_class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "assigned_by_id" varchar NOT NULL,
        "notes" text,
        "created_at" timestamp DEFAULT now()
);

ALTER TABLE "semester_announcement_classes" ADD COLUMN IF NOT EXISTS "teacher_id" varchar;

CREATE INDEX IF NOT EXISTS "idx_semester_announcement_classes_announcement" 
ON "semester_announcement_classes" ("announcement_id");

CREATE INDEX IF NOT EXISTS "idx_semester_recommendations_announcement" 
ON "semester_recommendations" ("announcement_id");

CREATE INDEX IF NOT EXISTS "idx_semester_recommendations_student" 
ON "semester_recommendations" ("student_id");

CREATE TABLE IF NOT EXISTS "semester_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "announcement_id" varchar NOT NULL,
        "announcement_class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_semester_applications_announcement" 
ON "semester_applications" ("announcement_id");

CREATE INDEX IF NOT EXISTS "idx_semester_applications_student" 
ON "semester_applications" ("student_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_semester_applications_class_student" 
ON "semester_applications" ("announcement_class_id", "student_id");

CREATE TABLE IF NOT EXISTS "supplementary_classes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "date" varchar NOT NULL,
        "start_time" text NOT NULL,
        "end_time" text,
        "reason" text,
        "custom_reason" text,
        "send_reminder" boolean DEFAULT false,
        "reminder_sent" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "supplementary_students" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "supplementary_class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "sms_sent" boolean DEFAULT false,
        "reminder_sms_sent" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_supplementary_classes_center_date" 
ON "supplementary_classes" ("center_id", "date");

CREATE INDEX IF NOT EXISTS "idx_supplementary_classes_teacher" 
ON "supplementary_classes" ("teacher_id");

CREATE INDEX IF NOT EXISTS "idx_supplementary_students_class" 
ON "supplementary_students" ("supplementary_class_id");

CREATE INDEX IF NOT EXISTS "idx_supplementary_students_student" 
ON "supplementary_students" ("student_id");

ALTER TABLE "supplementary_classes" ALTER COLUMN "end_time" DROP NOT NULL;

ALTER TABLE "supplementary_classes" ADD COLUMN IF NOT EXISTS "classroom" text;
ALTER TABLE "supplementary_classes" ADD COLUMN IF NOT EXISTS "reminder_time" text;

ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "supplementary_sms_template" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "supplementary_reminder_sms_template" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "daily_notice_sms_template" text;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "tuition_visible_to_teachers" boolean DEFAULT false;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "toss_consent_status" text DEFAULT 'none';
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "toss_consent_at" timestamp;
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "toss_approved_at" timestamp;

CREATE TABLE IF NOT EXISTS "counseling_records" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "teacher_id" varchar NOT NULL,
  "counseling_date" date NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_counseling_records_center" 
ON "counseling_records" ("center_id");

CREATE INDEX IF NOT EXISTS "idx_counseling_records_student" 
ON "counseling_records" ("student_id");

CREATE TABLE IF NOT EXISTS "school_subjects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "school_subjects" ADD COLUMN IF NOT EXISTS "student_id" varchar NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "idx_school_subjects_center"
ON "school_subjects" ("center_id");

CREATE TABLE IF NOT EXISTS "school_grades" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "entered_by_id" varchar NOT NULL,
  "school_level" text NOT NULL,
  "grade_year" integer NOT NULL,
  "semester" integer NOT NULL,
  "exam_type" text NOT NULL,
  "subject" text NOT NULL,
  "score" integer NOT NULL,
  "grade" integer,
  "rank" integer,
  "total_students" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_school_grades_center"
ON "school_grades" ("center_id");

CREATE INDEX IF NOT EXISTS "idx_school_grades_student"
ON "school_grades" ("student_id");

CREATE INDEX IF NOT EXISTS "idx_school_grades_student_exam"
ON "school_grades" ("student_id", "school_level", "grade_year", "semester", "exam_type");

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "center_id" varchar,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp DEFAULT now(),
  "last_used_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user"
ON "push_subscriptions" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_endpoint"
ON "push_subscriptions" ("endpoint");

ALTER TABLE "class_videos" ADD COLUMN IF NOT EXISTS "is_all_students" boolean NOT NULL DEFAULT true;
ALTER TABLE "class_videos" ADD COLUMN IF NOT EXISTS "visible_to" text[];

CREATE TABLE IF NOT EXISTS "textbook_progress" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "progress_book" text,
  "review_book" text,
  "homework_calc" text,
  "homework_book" text,
  "notes" text,
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "teacher_check_in_settings" ADD COLUMN IF NOT EXISTS "check_out_message_template" text;

ALTER TABLE "textbook_progress" ADD COLUMN IF NOT EXISTS "year_month" varchar(7) NOT NULL DEFAULT '2025-01';

ALTER TABLE "textbook_progress" ADD COLUMN IF NOT EXISTS "learning_level" text;

CREATE TABLE IF NOT EXISTS "work_journals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "teacher_id" varchar NOT NULL,
  "period_type" varchar(10) NOT NULL,
  "period_value" varchar(20) NOT NULL,
  "common_notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "work_journal_class_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journal_id" varchar NOT NULL,
  "class_id" varchar NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "work_journal_student_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journal_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_work_journals_teacher" ON "work_journals" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_work_journals_center" ON "work_journals" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_work_journal_class_notes_journal" ON "work_journal_class_notes" ("journal_id");
CREATE INDEX IF NOT EXISTS "idx_work_journal_student_notes_journal" ON "work_journal_student_notes" ("journal_id");

ALTER TABLE "student_monthly_reports" ADD COLUMN IF NOT EXISTS "exam_results_summary" text;

ALTER TABLE "sms_history" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "sms_history" ADD COLUMN IF NOT EXISTS "reference_id" varchar;
ALTER TABLE "sms_history" ADD COLUMN IF NOT EXISTS "error_message" text;

ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "sms_mode" text DEFAULT 'none';
ALTER TABLE "centers" ADD COLUMN IF NOT EXISTS "credit_sender_number" text;

CREATE TABLE IF NOT EXISTS "sms_credits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "balance" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sms_credit_transactions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "amount" integer NOT NULL,
  "type" text NOT NULL,
  "description" text,
  "message_type" text,
  "payment_key" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sms_credits_center" ON "sms_credits" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_sms_credit_transactions_center" ON "sms_credit_transactions" ("center_id");
ALTER TABLE "sms_credits" ADD COLUMN IF NOT EXISTS "low_balance_notify_enabled" boolean NOT NULL DEFAULT true;

-- 자동결제(Toss BillingKey) 기능 제거됨. 운영 DB의 기존 테이블은 그대로 두되 코드에서는 사용하지 않음.

ALTER TABLE "user_menu_orders" ADD COLUMN IF NOT EXISTS "sub_menu_order" text;

CREATE TABLE IF NOT EXISTS "math_workbooks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "title" text NOT NULL,
  "created_by" varchar NOT NULL,
  "total_pages" integer DEFAULT 0,
  "paid_pages" integer DEFAULT 0,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "math_workbook_pages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workbook_id" varchar NOT NULL,
  "page_number" integer NOT NULL,
  "image_url" text NOT NULL,
  "r2_object_key" text,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "detection_status" varchar(20),
  "created_at" timestamp DEFAULT now()
);
ALTER TABLE "math_workbook_pages" ADD COLUMN IF NOT EXISTS "detection_status" varchar(20);
ALTER TABLE "math_workbook_pages" ALTER COLUMN "detection_status" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "math_problems" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" varchar NOT NULL,
  "problem_number" text NOT NULL,
  "label" text,
  "image_url" text,
  "r2_object_key" text,
  "crop_x" integer NOT NULL,
  "crop_y" integer NOT NULL,
  "crop_width" integer NOT NULL,
  "crop_height" integer NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "math_wrong_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "workbook_id" varchar NOT NULL,
  "title" text NOT NULL,
  "created_by" varchar NOT NULL,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "math_wrong_note_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wrong_note_id" varchar NOT NULL,
  "problem_id" varchar NOT NULL,
  "sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "math_wrong_note_students" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wrong_note_id" varchar NOT NULL,
  "student_id" varchar NOT NULL,
  "assigned_by" varchar NOT NULL,
  "assigned_at" timestamp DEFAULT now(),
  "solve_count" integer DEFAULT 0 NOT NULL
);
ALTER TABLE "math_wrong_note_students" ADD COLUMN IF NOT EXISTS "solve_count" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "math_wrong_note_folders" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "name" text NOT NULL,
  "parent_id" varchar,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "math_wrong_notes" ADD COLUMN IF NOT EXISTS "folder_id" varchar;
ALTER TABLE "math_wrong_notes" ADD COLUMN IF NOT EXISTS "created_by_role" varchar(20);

CREATE TABLE IF NOT EXISTS "math_workbook_folders" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "center_id" varchar NOT NULL,
  "name" text NOT NULL,
  "parent_id" varchar,
  "created_by" varchar NOT NULL,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE "math_workbooks" ADD COLUMN IF NOT EXISTS "folder_id" varchar;

CREATE INDEX IF NOT EXISTS "idx_math_workbook_folders_center" ON "math_workbook_folders" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_math_workbook_folders_parent" ON "math_workbook_folders" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_math_workbooks_center" ON "math_workbooks" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_math_workbook_pages_workbook" ON "math_workbook_pages" ("workbook_id");
CREATE INDEX IF NOT EXISTS "idx_math_problems_page" ON "math_problems" ("page_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_notes_center" ON "math_wrong_notes" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_note_items_note" ON "math_wrong_note_items" ("wrong_note_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_note_students_note" ON "math_wrong_note_students" ("wrong_note_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_note_students_student" ON "math_wrong_note_students" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_note_folders_center" ON "math_wrong_note_folders" ("center_id");
CREATE INDEX IF NOT EXISTS "idx_math_wrong_note_folders_parent" ON "math_wrong_note_folders" ("parent_id");

UPDATE "users" SET "wage_type" = 'hourly', "hourly_rate" = COALESCE("daily_rate", 0) WHERE "wage_type" = 'daily' AND ("hourly_rate" IS NULL OR "hourly_rate" = 0);
UPDATE "users" SET "wage_type" = 'hourly' WHERE "wage_type" = 'daily';
`;
