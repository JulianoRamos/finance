-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('create', 'update', 'delete');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
    "action" "audit_action" NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" UUID NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "request_id" UUID NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_record_idx" ON "audit_log"("table_name", "record_id", "id");

-- Escrito à mão: o antes e o depois de cada operação (LLD, seção 4.4).
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_snapshot_check" CHECK (
  ("action" = 'create' AND "before" IS NULL AND "after" IS NOT NULL)
  OR ("action" = 'update' AND "before" IS NOT NULL AND "after" IS NOT NULL)
  OR ("action" = 'delete' AND "before" IS NOT NULL AND "after" IS NULL)
);


-- Escrito à mão: a auditoria só recebe inserções do papel da api (LLD, seção 4.4). Ele recebeu, pelos
-- privilégios padrão do esquema, também a alteração e a exclusão, que perde aqui.
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM finance_app;
