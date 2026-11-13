-- CreateEnum
CREATE TYPE "login_step" AS ENUM ('password', 'second_factor', 'recovery');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "manages_access" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "last_used_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "origin" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_link" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,

    CONSTRAINT "recovery_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT,
    "origin" TEXT NOT NULL,
    "step" "login_step" NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_user_idx" ON "session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_link_token_hash_key" ON "recovery_link"("token_hash");

-- CreateIndex
CREATE INDEX "recovery_link_user_idx" ON "recovery_link"("user_id");

-- CreateIndex
CREATE INDEX "login_attempt_email_idx" ON "login_attempt"("email", "attempted_at");

-- CreateIndex
CREATE INDEX "login_attempt_origin_idx" ON "login_attempt"("origin", "attempted_at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_link" ADD CONSTRAINT "recovery_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_link" ADD CONSTRAINT "recovery_link_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o e-mail é gravado em minúsculas e sem espaços nas pontas, então o único dele vale
-- sem distinguir maiúsculas (LLD, seção 4.2).
ALTER TABLE "user" ADD CONSTRAINT "user_email_lowercase_check" CHECK ("email" = lower(btrim("email")));
