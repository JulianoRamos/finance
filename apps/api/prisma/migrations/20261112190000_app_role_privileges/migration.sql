-- O papel da api, finance_app, não é dono das tabelas (LLD, seção 4.4). Toda tabela e toda sequência
-- que o papel dono criar daqui em diante, neste esquema, já nasce com as permissões dele. Uma tabela
-- que precisa de menos tira as que sobram na própria migração, como a audit_log.

-- O uso do esquema é dado de forma explícita: um esquema recriado (como o do prisma migrate reset) não
-- traz o uso que o PostgreSQL dá a todos no esquema public original.
GRANT USAGE ON SCHEMA "public" TO finance_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO finance_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT USAGE, SELECT ON SEQUENCES TO finance_app;
