-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('checking', 'payment', 'cash');

-- CreateEnum
CREATE TYPE "institution" AS ENUM ('nubank', 'caixa', 'mercado_pago', 'bradesco', 'itau', 'banco_do_brasil', 'other');

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "entity_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "account_type" NOT NULL,
    "institution" "institution" NOT NULL,
    "is_reserve" BOOLEAN NOT NULL DEFAULT false,
    "opening_balance" DECIMAL(15,2) NOT NULL,
    "opening_balance_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_entity_id_idx" ON "account"("entity_id");

-- Escrito à mão: a entidade é do módulo Entidades e não tem relação no Prisma (LLD, seção 3). RESTRICT:
-- a entidade é desativada, e não excluída.
ALTER TABLE "account" ADD CONSTRAINT "account_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o nome não é vazio nem só de espaços.
ALTER TABLE "account" ADD CONSTRAINT "account_name_check" CHECK (btrim("name") <> '');

-- Escrito à mão: a conta não é excluída, e sim desativada (regra 6.20). O papel da api recebe as
-- permissões da tabela pelos privilégios padrão (migração app_role_privileges), menos a de excluir.
REVOKE DELETE, TRUNCATE ON "account" FROM finance_app;
