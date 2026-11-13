import { EntityForm } from '../../entity-form';
import { EntityLoadError } from '../../entity-load-error';
import { loadEntity } from '../../load-entity';

/** A edição da entidade, no lugar do detalhe, com a lista ao lado. */
export default async function EditEntity({ params }: PageProps<'/entities/[id]/edit'>) {
  const entity = await loadEntity((await params).id);
  if (!entity) return <EntityLoadError />;
  return <EntityForm entity={entity} />;
}
