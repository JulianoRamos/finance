import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  activeIs,
  apiError,
  type CategoryNature,
  type Clock,
  CLOCK,
  NAME_COLLATION,
  nameMatches,
  type PageRequest,
  type PermissionLevel,
  readFirst,
  readPage,
  type Sql,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import { EntitiesService } from '../entities/index.js';
import type { Category, CategoryTreeItem, CategoryEdit, CategoryTreePage, NewCategory } from './entries.dto.js';

/** A categoria como o Prisma a lê. */
interface CategoryRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly nature: CategoryNature;
  readonly active: boolean;
  readonly version: number;
}

/** A categoria lida pela consulta da árvore, com o pai e se o nome bate com a busca. */
type TreeRow = CategoryRow & { readonly matched: boolean };

/** A categoria como a pesquisa a devolve, com o nome do pai para o caminho (regra 6.22). */
export interface CategorySearchResult {
  readonly id: string;
  readonly name: string;
  readonly nature: CategoryNature;
  readonly parentName: string | null;
  readonly active: boolean;
}

/** A ordem da árvore: cada nível pelo nome, na ordem pt-BR. */
const TREE_ORDER = sql`name ${NAME_COLLATION}`;

/** A categoria como a rota a devolve, num objeto simples, que a árvore estende. */
function toCategory(row: CategoryRow) {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    nature: row.nature,
    active: row.active,
    version: row.version,
  };
}

/** A recusa da falta do nível nas pessoas físicas: a árvore é de todas elas (LLD, seção 4.6). */
function forbidden(required: PermissionLevel) {
  return apiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    required === 'view'
      ? 'Você não tem acesso a nenhuma pessoa física, e as categorias são delas.'
      : 'Você só pode ver as categorias, e não alterá-las.',
  );
}

/** Uma recusa do pai da categoria (LLD, seção 4.6). */
function parentRefused(code: string, message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
}

/**
 * O dono da tabela `category`: a árvore de categorias das pessoas físicas, com dois níveis (LLD, seção
 * 4.6). A árvore é de todas as pessoas físicas, e a permissão é a de alguma delas, lida das Entidades.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly entities: EntitiesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * A página da árvore de uma natureza, paginada pelas categorias de primeiro nível, cada uma com as
   * subcategorias, todas pelo nome. Com `active`, só as desse estado. A busca traz as de primeiro nível
   * que batem e as que têm uma subcategoria que bate, só com as subcategorias que batem.
   */
  async list(filter: {
    nature: CategoryNature;
    active?: boolean | undefined;
    q?: string | undefined;
    page: PageRequest;
  }): Promise<CategoryTreePage> {
    await this.requireLevel('view');
    const client = this.transactions.client;
    // A categoria passa pelos filtros: o estado pedido e a busca no nome.
    const passes = sql`${activeIs(filter.active)} AND ${nameMatches(filter.q)}`;
    // A de primeiro nível entra quando passa pelos filtros, ou como o caminho de uma subcategoria que passa.
    return readPage(
      client,
      sql`SELECT id, name FROM category top
        WHERE parent_id IS NULL AND nature = ${filter.nature}::category_nature
          AND ((${passes})
            OR EXISTS (SELECT 1 FROM category WHERE parent_id = top.id AND ${passes}))`,
      TREE_ORDER,
      filter.page,
      async (ids) => {
        const [parents, children] = await Promise.all([
          this.treeRows(sql`id = ANY(${ids}::uuid[])`, passes),
          this.treeRows(sql`parent_id = ANY(${ids}::uuid[]) AND ${passes}`, passes),
        ]);
        const byParent = Map.groupBy(children, (child) => child.parentId);
        return parents.map((parent): CategoryTreeItem => ({
          ...toTreeChild(parent),
          children: (byParent.get(parent.id) ?? []).map(toTreeChild),
        }));
      },
    );
  }

  /**
   * As primeiras categorias cujo nome tem o termo, sem acento nem diferença de maiúsculas, as ativas
   * primeiro e cada grupo pelo nome, com o nome do pai (regra 6.22). Vazia para quem não tem permissão em
   * nenhuma pessoa física.
   */
  async search(term: string, limit: number): Promise<CategorySearchResult[]> {
    if ((await this.entities.individualsLevel()) === null) return [];
    const client = this.transactions.client;
    return readFirst(
      client,
      sql`SELECT id, active, name FROM category WHERE ${nameMatches(term)}`,
      sql`active DESC, name ${NAME_COLLATION}`,
      limit,
      async (ids) => {
        const rows = await client.category.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, nature: true, active: true, parent: { select: { name: true } } },
        });
        return rows.map(({ parent, ...row }) => ({ ...row, parentName: parent?.name ?? null }));
      },
    );
  }

  /**
   * Cria a categoria, ativa e na versão 1, quando o usuário tem `operate` em alguma pessoa física. A
   * subcategoria tem a natureza do pai, que é de primeiro nível e está ativo.
   */
  async create(input: NewCategory): Promise<Category> {
    await this.requireLevel('operate');
    return this.transactions.run(async () => {
      let nature = input.nature;
      const parentId = input.parentId?.toLowerCase() ?? null;
      if (parentId !== null) {
        // A trava segura a desativação do pai até a subcategoria ser gravada.
        const parent = await this.readParent(parentId);
        if (nature !== undefined && nature !== parent.nature) throw natureMismatch();
        nature = parent.nature;
      }
      if (nature === undefined) throw new Error('A natureza chegou ao serviço sem passar pela validação.');
      const now = this.clock.now();
      const created = await this.transactions.client.category.create({
        data: { parentId, name: input.name.trim(), nature, createdAt: now, updatedAt: now },
      });
      await this.audit.record({
        action: 'create',
        tableName: 'category',
        recordId: created.id,
        entityId: null,
        before: null,
        after: created,
      });
      return toCategory(created);
    });
  }

  /**
   * Renomeia a categoria ou muda o pai dela, com a versão lida, quando o usuário tem `operate` em alguma
   * pessoa física. A natureza não muda: a edição manda a atual. O pai novo segue as regras da criação, e
   * uma categoria com subcategorias não vai para dentro de outra (LLD, seção 4.6).
   */
  async update(id: string, input: CategoryEdit): Promise<Category> {
    await this.requireLevel('operate');
    return this.transactions.run(async () => {
      // A trava exclusiva segura a criação de uma subcategoria nela, que trava o pai para ler, até a
      // contagem das subcategorias e a mudança do pai serem gravadas: a árvore não ganha um terceiro nível.
      const before = await this.find(id, { lock: 'update' });
      if (!before) throw notFound();
      if (before.version !== input.version) throw versionConflict();
      if (before.nature !== input.nature) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'CATEGORY_NATURE_IMMUTABLE',
          'A natureza da categoria não muda depois de criada. Para outra natureza, crie outra categoria.',
        );
      }
      const parentId = input.parentId?.toLowerCase() ?? null;
      // O pai só é conferido quando muda: renomear a subcategoria de um pai desativado continua valendo.
      if (parentId !== null && parentId !== before.parentId) {
        if (parentId === before.id) throw parentRefused('INVALID_PARENT', 'A categoria não pode ser pai dela mesma.');
        const parent = await this.readParent(parentId);
        if (parent.nature !== before.nature) throw natureMismatch();
        const children = await this.transactions.client.category.count({ where: { parentId: before.id } });
        if (children > 0) {
          throw parentRefused(
            'CATEGORY_TOO_DEEP',
            'Esta categoria tem subcategorias e não vai para dentro de outra: a árvore tem só dois níveis.',
          );
        }
      }
      return toCategory(await this.updateVersioned(before, { name: input.name.trim(), parentId }));
    });
  }

  /**
   * Desativa ou reativa a categoria, com a versão lida, quando o usuário tem `operate` em alguma pessoa
   * física. Desativar a de primeiro nível desativa as subcategorias ativas dela na mesma transação, cada
   * uma com a auditoria; reativar reativa só ela, e a subcategoria de um pai desativado não é reativada.
   * Pedir o estado que ela já tem não muda nada. Desativar não apaga nada (regra 6.20).
   */
  async setActive(id: string, active: boolean, version: number): Promise<Category> {
    await this.requireLevel('operate');
    return this.transactions.run(async () => {
      const before = await this.read(id);
      if (before.active === active) return toCategory(before);
      if (before.version !== version) throw versionConflict();
      if (active && before.parentId !== null) {
        // A trava segura a desativação do pai até a subcategoria ser reativada.
        const parent = await this.find(before.parentId, { lock: 'share' });
        if (!parent?.active) {
          throw parentRefused(
            'INACTIVE_PARENT',
            'A categoria pai desta subcategoria está desativada. Reative o pai antes.',
          );
        }
      }
      const after = await this.updateVersioned(before, { active });
      if (!active) {
        const children = await this.transactions.client.category.findMany({
          where: { parentId: before.id, active: true },
          orderBy: { id: 'asc' },
        });
        for (const child of children) await this.updateVersioned(child, { active: false });
      }
      return toCategory(after);
    });
  }

  /**
   * Grava os dados na categoria lida, na versão seguinte, com a auditoria. A versão vai no filtro: se
   * outro pedido mudou a categoria depois da leitura, nada é gravado, e a resposta é o conflito.
   */
  private async updateVersioned(
    before: CategoryRow,
    data: Partial<Pick<CategoryRow, 'name' | 'parentId' | 'active'>>,
  ): Promise<CategoryRow> {
    const { count } = await this.transactions.client.category.updateMany({
      where: { id: before.id, version: before.version },
      data: { ...data, updatedAt: this.clock.now(), version: { increment: 1 } },
    });
    if (count === 0) throw versionConflict();
    const after = await this.read(before.id);
    await this.audit.record({
      action: 'update',
      tableName: 'category',
      recordId: before.id,
      entityId: null,
      // A cópia é um objeto simples, que a auditoria aceita; a interface da linha não tem índice.
      before: { ...before },
      after: { ...after },
    });
    return after;
  }

  /** A categoria do id, ou a recusa 404. */
  private async read(id: string): Promise<CategoryRow> {
    const row = await this.find(id);
    if (!row) throw notFound();
    return row;
  }

  /**
   * A categoria do id, ou nula. Com `lock`, trava-a até o fim da transação (`share` para ler, `update` para
   * alterá-la): uma alteração ao mesmo tempo espera, ou é esperada e já aparece aqui.
   */
  private async find(id: string, options: { lock?: 'share' | 'update' } = {}): Promise<CategoryRow | null> {
    if (options.lock === 'share') {
      await this.transactions.client.$queryRaw`SELECT 1 FROM category WHERE id = ${id}::uuid FOR SHARE`;
    } else if (options.lock === 'update') {
      await this.transactions.client.$queryRaw`SELECT 1 FROM category WHERE id = ${id}::uuid FOR UPDATE`;
    }
    return this.transactions.client.category.findUnique({ where: { id } });
  }

  /**
   * O pai pedido para uma subcategoria, travado até o fim da transação, ou a recusa: ele existe, é de
   * primeiro nível e está ativo (LLD, seção 4.6).
   */
  private async readParent(parentId: string): Promise<CategoryRow> {
    const parent = await this.find(parentId, { lock: 'share' });
    if (!parent) throw parentRefused('INVALID_PARENT', 'A categoria pai escolhida não existe.');
    if (parent.parentId !== null) {
      throw parentRefused(
        'CATEGORY_TOO_DEEP',
        'A categoria pai escolhida já é uma subcategoria: a árvore tem só dois níveis.',
      );
    }
    if (!parent.active) {
      throw parentRefused('INACTIVE_PARENT', 'A categoria pai escolhida está desativada. Reative-a antes.');
    }
    return parent;
  }

  /**
   * As categorias da condição, pelo nome, com o que diz se cada uma passa pelos filtros (`matched`): a de
   * primeiro nível que não passa só aparece como o caminho de uma subcategoria que passa.
   */
  private treeRows(where: Sql, passes: Sql): Promise<TreeRow[]> {
    return this.transactions.client.$queryRaw<TreeRow[]>`
      SELECT id::text AS id, parent_id::text AS "parentId", name, nature::text AS nature, active, version,
        ${passes} AS matched
      FROM category WHERE ${where}
      ORDER BY ${TREE_ORDER}, id`;
  }

  /** Confere o maior nível do usuário da requisição nas pessoas físicas: `operate` vale também para ler. */
  private async requireLevel(required: PermissionLevel): Promise<void> {
    const level = await this.entities.individualsLevel();
    if (level === null || (required === 'operate' && level !== 'operate')) throw forbidden(required);
  }
}

/** A recusa da categoria que não existe. */
function notFound() {
  return apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Esta categoria não existe.');
}

/** A recusa da versão que não é a atual (regra 6.20). */
function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Esta categoria mudou desde que você a abriu. Recarregue para ver os dados atuais.',
  );
}

/** A recusa do pai de outra natureza (LLD, seção 4.6). */
function natureMismatch() {
  return parentRefused(
    'PARENT_NATURE_MISMATCH',
    'A categoria pai escolhida é de outra natureza: a subcategoria tem a natureza do pai.',
  );
}

/** A categoria da árvore como a rota a devolve, sem as subcategorias. */
function toTreeChild(row: TreeRow) {
  return { ...toCategory(row), matched: row.matched };
}
