-- O banco dos testes de integração da api, no mesmo serviço do banco de desenvolvimento, que os
-- testes nunca tocam. Roda só na criação do volume do banco: num volume que já existe, recrie-o com
-- `docker compose -f compose.dev.yaml down -v`.
CREATE DATABASE finance_test;
