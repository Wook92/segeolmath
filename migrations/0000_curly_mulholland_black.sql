CREATE TABLE IF NOT EXISTS "assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"assessment_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_pins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"center_id" varchar NOT NULL,
	"pin" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "centers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"teacher_id" varchar NOT NULL,
	"note_date" date NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"title" text NOT NULL,
	"youtube_url" text NOT NULL,
	"thumbnail_url" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_assignment_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"step_id" varchar,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_assignment_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"step_order" integer NOT NULL,
	"instruction" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_daily_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_student_id" varchar NOT NULL,
	"note_date" date NOT NULL,
	"content" text NOT NULL,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_resources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"description" text,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"week_start_date" date,
	"uploaded_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_students" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"regular_teacher_id" varchar NOT NULL,
	"clinic_teacher_id" varchar,
	"center_id" varchar NOT NULL,
	"clinic_days" text[] NOT NULL,
	"default_instructions" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"class_id" varchar NOT NULL,
	"enrolled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "homework" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"student_id" varchar,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solapi_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"api_secret" text NOT NULL,
	"sender_number" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "solapi_credentials_center_id_unique" UNIQUE("center_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_class_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"teacher_id" varchar NOT NULL,
	"note_date" date NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_cafe_seats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" varchar NOT NULL,
	"seat_number" integer NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_cafe_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" varchar NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"notice" text,
	"entry_password" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "study_cafe_settings_center_id_unique" UNIQUE("center_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "textbook_videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"textbook_id" varchar NOT NULL,
	"page_number" integer NOT NULL,
	"problem_number" integer NOT NULL,
	"youtube_url" text NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "textbooks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"cover_image" text,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "todo_assignees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" varchar NOT NULL,
	"assignee_id" varchar NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"completed_for_date" date
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tuition_access_passwords" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tuition_access_passwords_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tuition_guidances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" varchar NOT NULL,
	"guidance_text" text,
	"image_urls" text[] DEFAULT '{}',
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tuition_guidances_center_id_unique" UNIQUE("center_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_centers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"center_id" varchar NOT NULL
);
--> statement-breakpoint
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
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Add FK constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk'
  ) THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" 
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
