import { databaseClient, migrateDeploy, requiredEnv } from './support/database.js';

/**
 * A tabela do comando de prova da auditoria (test/support/), só do banco de teste: ainda não há tabela
 * de domínio. Recriada pelo papel dono a cada suíte, depois das migrações, com a definição atual, ela
 * recebe do papel da api as permissões padrão do esquema, como uma tabela de domínio. A auditoria é
 * esvaziada junto: o papel da api não pode apagá-la.
 */
const RESET_AUDIT_PROBE = [
  'DROP TABLE IF EXISTS audit_probe',
  'CREATE TABLE audit_probe (id uuid PRIMARY KEY, name text NOT NULL)',
  'TRUNCATE audit_log',
];

/**
 * Prepara o banco de teste antes da suíte, com o papel dono (DATABASE_OWNER_URL_TEST): aplica as
 * migrações e cria a tabela de prova. Os testes se conectam com o papel da api (DATABASE_URL_TEST).
 */
export default async function setupDatabase(): Promise<void> {
  requiredEnv('DATABASE_URL_TEST');
  const ownerUrl = requiredEnv('DATABASE_OWNER_URL_TEST');
  migrateDeploy(ownerUrl);
  const owner = databaseClient(ownerUrl);
  try {
    for (const statement of RESET_AUDIT_PROBE) await owner.$executeRawUnsafe(statement);
  } finally {
    await owner.$disconnect();
  }
}
