-- CreateEnum
CREATE TYPE "category_nature" AS ENUM ('revenue', 'expense');

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "nature" "category_nature" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_nature_parent_id_idx" ON "category"("nature", "parent_id");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Escrito à mão: o nome não é vazio nem só de espaços.
ALTER TABLE "category" ADD CONSTRAINT "category_name_check" CHECK (btrim("name") <> '');

-- Escrito à mão: a categoria não é pai dela mesma.
ALTER TABLE "category" ADD CONSTRAINT "category_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

-- Escrito à mão: a categoria não é excluída, e sim desativada (regra 6.20). O papel da api recebe as
-- permissões da tabela pelos privilégios padrão (migração app_role_privileges), menos a de excluir.
REVOKE DELETE, TRUNCATE ON "category" FROM finance_app;

-- Escrito à mão: a árvore das pessoas físicas nasce com as categorias de primeiro nível do LLD (seção
-- 4.6), ativas, na versão 1, uma vez só em cada banco. Elas não vão para a auditoria, porque não há
-- pedido nem usuário.
INSERT INTO "category" ("name", "nature", "created_at", "updated_at")
VALUES
    ('Moradia', 'expense', now(), now()),
    ('Alimentação', 'expense', now(), now()),
    ('Transporte', 'expense', now(), now()),
    ('Saúde', 'expense', now(), now()),
    ('Educação', 'expense', now(), now()),
    ('Lazer', 'expense', now(), now()),
    ('Vestuário', 'expense', now(), now()),
    ('Serviços e assinaturas', 'expense', now(), now()),
    ('Impostos e taxas', 'expense', now(), now()),
    ('Despesas financeiras', 'expense', now(), now()),
    ('Outras', 'expense', now(), now()),
    ('Salário', 'revenue', now(), now()),
    ('Pró-labore', 'revenue', now(), now()),
    ('Distribuição de lucros', 'revenue', now(), now()),
    ('Rendimentos', 'revenue', now(), now()),
    ('Outras', 'revenue', now(), now());
