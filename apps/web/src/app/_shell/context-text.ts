import type { CurrentFinancialContext, FinancialContext } from '@/api/financial-context';

import type { ContextIcon, ShownContext } from './context-selector';

const LIST = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' });

/** Quantos de um tipo, por extenso: "1 pessoa física", "2 empresas". */
function counted(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Quantas entidades o contexto reúne, contando só os tipos presentes: "2 pessoas físicas",
 * "1 pessoa física e 1 empresa". Vazio num grupo sem membros.
 */
export function entitiesCount(context: FinancialContext): string {
  const individuals = context.entities.filter((entity) => entity.type === 'individual').length;
  const companies = context.entities.length - individuals;
  const parts = [
    ...(individuals > 0 ? [counted(individuals, 'pessoa física', 'pessoas físicas')] : []),
    ...(companies > 0 ? [counted(companies, 'empresa', 'empresas')] : []),
  ];
  return LIST.format(parts);
}

/** O tipo do contexto, que dá o ícone dele: o grupo, ou o tipo da entidade. */
function contextKind(context: FinancialContext): ContextIcon {
  if (context.kind === 'group') return 'group';
  return context.entities[0]?.type ?? 'individual';
}

const KIND_NAMES: Record<ContextIcon, string> = { group: 'Grupo', individual: 'Pessoa física', company: 'Empresa' };

/** O tipo do contexto: "Grupo", "Pessoa física" ou "Empresa". */
export function contextType(context: FinancialContext): string {
  return KIND_NAMES[contextKind(context)];
}

/** A linha do seletor abaixo do nome: o tipo e, num grupo, o resumo ("Grupo · 2 pessoas físicas"). */
function contextSummary(context: FinancialContext): string {
  if (context.kind !== 'group') return contextType(context);
  return `Grupo · ${context.entities.length === 0 ? 'Sem membros' : entitiesCount(context)}`;
}

/**
 * O contexto atual como o seletor o mostra; `none` quando o usuário não vê nenhum, ou `unavailable` quando
 * a api não respondeu.
 */
export function selectedContextOf(current: CurrentFinancialContext): ShownContext {
  if (current.status !== 'ok') return current.status === 'none' ? 'none' : 'unavailable';
  const { context, reference } = current;
  return { reference, name: context.name, summary: contextSummary(context), icon: contextKind(context) };
}
