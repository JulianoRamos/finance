import { type InstallmentStatus, STATUS_NAMES } from './entry-text';

/** A cor de cada situação (design-system.md, seção 4.4): a prevista é neutra, e a vencida, negativa. */
const STATUS_STYLES: Readonly<Record<InstallmentStatus, string>> = {
  expected: 'bg-surface-subtle text-body',
  overdue: 'bg-negative-soft text-negative',
};

/** O selo da situação da parcela, com o texto dela: a cor só acompanha (design-system.md, seção 7). */
export function StatusBadge({ status }: Readonly<{ status: InstallmentStatus }>) {
  return (
    <span
      className={`inline-flex flex-none rounded-full px-2 text-body-sm font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_NAMES[status]}
    </span>
  );
}
