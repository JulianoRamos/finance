import Link from 'next/link';

import { getEntity } from '@/api/entities';

import { PRIMARY_BUTTON } from '../../../_shell/buttons';
import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { formatTaxId, TYPE_NAMES } from '../tax-id-format';
import { ActivationForm } from './activation-form';
import { OperationSwitch } from './operation-switch';

const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';

/** O detalhe da entidade: o nome, o tipo e o documento completo, as operações e as ações. */
export default async function EntityDetail({ params }: PageProps<'/entities/[id]'>) {
  const { id } = await params;
  const entity = await loadOrNotFound(() => getEntity(id));
  if (!entity) return <LoadError>Não foi possível carregar a entidade.</LoadError>;
  const document = entity.taxId ? formatTaxId(entity.type, entity.taxId) : 'Sem documento';

  return (
    <section aria-labelledby="entity-title" className={PANEL}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="entity-title" className="text-heading-md wrap-anywhere text-ink">
            {entity.name}
          </h2>
          {!entity.active && (
            <span className="rounded-full bg-surface-subtle px-2 text-body-sm font-medium text-body">Desativada</span>
          )}
        </div>
        <p>
          {TYPE_NAMES[entity.type]} · {document}
        </p>
      </div>
      {entity.type === 'company' && (
        <section aria-labelledby="operations-title" className="flex flex-col gap-3 border-t border-hairline pt-6">
          <div className="flex flex-col gap-1">
            <h3 id="operations-title" className="text-heading-sm text-ink">
              Operações
            </h3>
            <p className="text-body-sm text-mute">
              Funções de um segmento, além do financeiro que toda empresa tem. Desligar esconde as funções e não apaga
              nada.
            </p>
          </div>
          <OperationSwitch
            entityId={entity.id}
            entityName={entity.name}
            enabled={entity.operations.includes('clinic')}
          />
        </section>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-hairline pt-4">
        <ActivationForm entityId={entity.id} entityName={entity.name} version={entity.version} active={entity.active} />
        <Link href={`/entities/${entity.id}/edit`} className={PRIMARY_BUTTON}>
          Editar dados
        </Link>
      </div>
    </section>
  );
}
