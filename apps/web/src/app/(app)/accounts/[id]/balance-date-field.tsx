'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { inputClass } from '../../../_access/fields';
import { SEARCH_DELAY_MS } from '../../../_shell/pagination';
import { withSearchParam } from '../../../_shell/search-params';

/** Uma data com o ano inteiro: enquanto a pessoa digita o ano, o campo já vale "0002-09-15". */
const FULL_YEAR_DATE = /^[1-9]\d{3}-\d{2}-\d{2}$/;

/**
 * O campo do "Saldo em", ligado ao `?balanceDate=` do endereço: a data escolhida pede ao servidor o saldo
 * dela, que ele lê na api. Espera a digitação parar, como a busca, e só pede com o ano inteiro. O campo
 * guarda o que foi digitado e só volta à data do endereço quando ela muda por fora, como ao voltar no
 * navegador, sem perder o foco de quem digita.
 */
export function BalanceDateField({ id, date }: Readonly<{ id: string; date: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [value, setValue] = useState(date);
  const [shownDate, setShownDate] = useState(date);
  if (date !== shownDate) {
    setShownDate(date);
    setValue(date);
  }
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(event) => {
        const chosen = event.currentTarget.value;
        setValue(chosen);
        clearTimeout(timer.current);
        if (!FULL_YEAR_DATE.test(chosen)) return;
        timer.current = setTimeout(() => {
          router.replace(withSearchParam(pathname, searchParams, 'balanceDate', chosen), { scroll: false });
        }, SEARCH_DELAY_MS);
      }}
      className={`${inputClass('app')} tabular-nums`}
    />
  );
}
