-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'COMPANY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'STUDENT';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "job_title" VARCHAR(100);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_feedback" (
    "id" UUID NOT NULL,
    "company_profile_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_user_id_key" ON "company_profiles"("user_id");

-- CreateIndex
CREATE INDEX "company_feedback_company_profile_id_created_at_idx" ON "company_feedback"("company_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "company_feedback_student_profile_id_created_at_idx" ON "company_feedback"("student_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_feedback" ADD CONSTRAINT "company_feedback_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_feedback" ADD CONSTRAINT "company_feedback_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Defense in depth: feedback messages must contain non-whitespace text.
ALTER TABLE "company_feedback" ADD CONSTRAINT "company_feedback_message_not_blank" CHECK (char_length(btrim("message")) > 0);
