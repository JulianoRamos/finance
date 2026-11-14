import { getEntity } from '@/api/entities';

import { LoadError } from '../../../../_shell/load-error';
import { loadOrNotFound } from '../../../../_shell/load-or-not-found';
import { EntityForm } from '../../entity-form';

/** A edição da entidade, no lugar do detalhe, com a lista ao lado. */
export default async function EditEntity({ params }: PageProps<'/entities/[id]/edit'>) {
  const { id } = await params;
  const entity = await loadOrNotFound(() => getEntity(id));
  if (!entity) return <LoadError>Não foi possível carregar a entidade.</LoadError>;
  return <EntityForm entity={entity} />;
}
