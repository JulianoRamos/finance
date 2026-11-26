-- AlterTable
ALTER TABLE "installment" ADD COLUMN     "reconciled_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reconciliation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "movement_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reconciliation_installment_id_idx" ON "reconciliation"("installment_id");

-- CreateIndex
CREATE INDEX "reconciliation_movement_id_idx" ON "reconciliation"("movement_id");

-- Escrito à mão: a movimentação é do módulo Contas, sem relação no Prisma (LLD, seção 3).
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "movement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a parcela é do módulo Lançamentos, pelo mesmo motivo.
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o usuário é do módulo Identidade, pelo mesmo motivo. "user" é palavra reservada.
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o valor conciliado é maior que zero (LLD, seção 4.1).
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_amount_check" CHECK ("amount" > 0);

-- Escrito à mão: a soma conciliada da parcela vai de zero ao valor dela (regra 6.5).
ALTER TABLE "installment" ADD CONSTRAINT "installment_reconciled_amount_check" CHECK ("reconciled_amount" >= 0 AND "reconciled_amount" <= "amount");
