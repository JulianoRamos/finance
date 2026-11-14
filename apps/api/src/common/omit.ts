/**
 * O registro sem a chave dada, como a relação que o Prisma lê junto com o `include` e que é de outra
 * tabela: a auditoria guarda só as colunas da tabela do registro.
 */
export function omit<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(row).filter(([column]) => column !== key)) as Omit<T, K>;
}
