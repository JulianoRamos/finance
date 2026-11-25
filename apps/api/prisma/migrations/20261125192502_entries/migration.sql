-- CreateEnum
CREATE TYPE "entry_type" AS ENUM ('revenue', 'expense');

-- CreateEnum
CREATE TYPE "entry_effect" AS ENUM ('revenue', 'expense');

-- CreateEnum
CREATE TYPE "entry_purpose" AS ENUM ('personal', 'household');

-- CreateTable
CREATE TABLE "entry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "entity_id" UUID NOT NULL,
    "type" "entry_type" NOT NULL,
    "effect" "entry_effect" NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "purpose" "entry_purpose",
    "occurred_on" DATE NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "payer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "entry_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "movement_direction" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entry_category_id_idx" ON "entry"("category_id");

-- CreateIndex
CREATE INDEX "entry_entity_id_idx" ON "entry"("entity_id");

-- CreateIndex
CREATE INDEX "installment_due_date_idx" ON "installment"("due_date");

-- CreateIndex
CREATE INDEX "installment_account_id_idx" ON "installment"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "installment_entry_id_number_direction_key" ON "installment"("entry_id", "number", "direction");

-- AddForeignKey
ALTER TABLE "entry" ADD CONSTRAINT "entry_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment" ADD CONSTRAINT "installment_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a entidade dona é do módulo Entidades, sem relação no Prisma (LLD, seção 3).
ALTER TABLE "entry" ADD CONSTRAINT "entry_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o pagador é uma entidade, pelo mesmo motivo.
ALTER TABLE "entry" ADD CONSTRAINT "entry_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a conta é do módulo Contas, sem relação no Prisma (LLD, seção 3).
ALTER TABLE "installment" ADD CONSTRAINT "installment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a descrição não é vazia nem só de espaços.
ALTER TABLE "entry" ADD CONSTRAINT "entry_description_check" CHECK (btrim("description") <> '');

-- Escrito à mão: o efeito é o do tipo (regra 6.8).
ALTER TABLE "entry" ADD CONSTRAINT "entry_effect_check" CHECK ("effect"::text = "type"::text);

-- Escrito à mão: a despesa tem a finalidade, e a receita não (GLOSSARY.md, Finalidade).
ALTER TABLE "entry" ADD CONSTRAINT "entry_purpose_check" CHECK (("type" = 'expense') = ("purpose" IS NOT NULL));

-- Escrito à mão: o pagador é a dona; o de outra entidade entra com o reembolso pendente (regra 6.10).
ALTER TABLE "entry" ADD CONSTRAINT "entry_payer_check" CHECK ("payer_id" = "entity_id");

-- Escrito à mão: o total é maior que zero (LLD, seção 4.1).
ALTER TABLE "entry" ADD CONSTRAINT "entry_total_amount_check" CHECK ("total_amount" > 0);

-- Escrito à mão: o valor da parcela é maior que zero (LLD, seção 4.1).
ALTER TABLE "installment" ADD CONSTRAINT "installment_amount_check" CHECK ("amount" > 0);

-- Escrito à mão: o número da parcela é a partir de 1.
ALTER TABLE "installment" ADD CONSTRAINT "installment_number_check" CHECK ("number" >= 1);

-- Escrito à mão: o lançamento e a parcela não são excluídos pela api por enquanto: a exclusão e o
-- cancelamento entram com as regras deles (regra 6.20). O papel da api recebe as permissões das tabelas
-- pelos privilégios padrão (migração app_role_privileges), menos a de excluir.
REVOKE DELETE, TRUNCATE ON "entry" FROM finance_app;
REVOKE DELETE, TRUNCATE ON "installment" FROM finance_app;
