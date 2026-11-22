-- CreateEnum
CREATE TYPE "movement_direction" AS ENUM ('inflow', 'outflow');

-- CreateEnum
CREATE TYPE "movement_source" AS ENUM ('manual');

-- CreateTable
CREATE TABLE "movement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "direction" "movement_direction" NOT NULL,
    "description" TEXT NOT NULL,
    "source" "movement_source" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movement_account_id_date_idx" ON "movement"("account_id", "date");

-- AddForeignKey
ALTER TABLE "movement" ADD CONSTRAINT "movement_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o valor é sempre maior que zero, com o sentido em `direction` (LLD, seção 4.1).
ALTER TABLE "movement" ADD CONSTRAINT "movement_amount_check" CHECK ("amount" > 0);

-- Escrito à mão: a descrição não é vazia nem só de espaços.
ALTER TABLE "movement" ADD CONSTRAINT "movement_description_check" CHECK (btrim("description") <> '');
