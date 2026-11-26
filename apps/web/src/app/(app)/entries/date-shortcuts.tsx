'use client';

import { FOCUS_RING } from '../../_access/access-screen';

/** Os dias que os atalhos põem no campo de data, `AAAA-MM-DD`. */
export interface ShortcutDays {
  readonly today: string;
  readonly yesterday: string;
}

/**
 * Os atalhos "Hoje" e "Ontem" ao lado de um campo de data dos lançamentos (design-system.md, seção 4.3),
 * que põem o dia no campo pelo `onPick`.
 */
export function DateShortcuts({ days, onPick }: Readonly<{ days: ShortcutDays; onPick: (date: string) => void }>) {
  return (
    <span className="ml-3 flex flex-none items-center gap-3">
      {[
        { label: 'Hoje', date: days.today },
        { label: 'Ontem', date: days.yesterday },
      ].map((shortcut) => (
        <button
          key={shortcut.label}
          type="button"
          onClick={() => {
            onPick(shortcut.date);
          }}
          className={`rounded-sm text-label text-link hover:underline ${FOCUS_RING}`}
        >
          {shortcut.label}
        </button>
      ))}
    </span>
  );
}
