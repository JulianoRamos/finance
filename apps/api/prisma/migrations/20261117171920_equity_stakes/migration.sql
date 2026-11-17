-- CreateTable
CREATE TABLE "equity_stake" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "holder_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fraction" DECIMAL(9,8) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "equity_stake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equity_stake_company_id_idx" ON "equity_stake"("company_id");

-- CreateIndex
CREATE INDEX "equity_stake_holder_id_idx" ON "equity_stake"("holder_id");

-- AddForeignKey
ALTER TABLE "equity_stake" ADD CONSTRAINT "equity_stake_holder_id_fkey" FOREIGN KEY ("holder_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stake" ADD CONSTRAINT "equity_stake_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: a fração é de mais de 0 até 1 (LLD, seção 4.1).
ALTER TABLE "equity_stake" ADD CONSTRAINT "equity_stake_fraction_check" CHECK ("fraction" > 0 AND "fraction" <= 1);

-- Escrito à mão: sem fim, ou com o último dia no mesmo dia do início ou depois dele.
ALTER TABLE "equity_stake" ADD CONSTRAINT "equity_stake_period_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

-- Escrito à mão: nenhuma empresa participa de si mesma.
ALTER TABLE "equity_stake" ADD CONSTRAINT "equity_stake_self_check" CHECK ("holder_id" <> "company_id");

-- Escrito à mão: a participação não é excluída, e sim encerrada (regra 6.2). O papel da api recebe as
-- permissões da tabela pelos privilégios padrão (migração app_role_privileges), menos a de excluir.
REVOKE DELETE, TRUNCATE ON "equity_stake" FROM finance_app;
