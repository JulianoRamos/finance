import { Injectable } from '@nestjs/common';

/**
 * A porta dos nomes dos usuários (LLD, seção 3): o histórico mostra o nome de quem fez, que é da
 * Identidade, e a Auditoria não chama nenhum módulo. A Identidade a implementa e a registra no
 * `UserNamesRegistry`.
 */
export interface UserNames {
  /** O nome atual de cada usuário dos ids, ativo ou desativado. O id que não existe fica de fora. */
  namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

/** Onde a Identidade registra a porta dos nomes, para a Auditoria usá-la sem importar a Identidade. */
@Injectable()
export class UserNamesRegistry implements UserNames {
  private source: UserNames | null = null;

  /** Registra a implementação da porta. */
  register(source: UserNames): void {
    this.source = source;
  }

  namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (!this.source) throw new Error('A porta dos nomes dos usuários não foi registrada pela Identidade.');
    return this.source.namesOf(ids);
  }
}
