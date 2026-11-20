'use client';

import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';

import { TOP_BAR_ICON_BUTTON } from './buttons';
import { Hint } from './hint';
import { MENU_ITEM, MENU_LABEL, MENU_PANEL } from './menu';
import { writePreferenceCookie } from './preference-cookie';
import { dataThemeOf, THEME_CHOICES, THEME_COOKIE, type ThemeChoice, themeChoiceOf } from './theme';

const OPTIONS: Readonly<Record<ThemeChoice, { label: string; icon: LucideIcon }>> = {
  light: { label: 'Claro', icon: Sun },
  dark: { label: 'Escuro', icon: Moon },
  system: { label: 'Sistema', icon: Monitor },
};

/**
 * Grava a escolha no cookie e troca o `data-theme` do `<html>` na hora, sem ir ao servidor: a próxima
 * carga e todo novo render do layout raiz já leem o cookie. Um `router.refresh()` aqui só refaria a
 * página no servidor e, com duas escolhas seguidas, podia trazer de volta a anterior por um instante.
 */
function applyTheme(choice: ThemeChoice): void {
  writePreferenceCookie(THEME_COOKIE, choice);
  const dataTheme = dataThemeOf(choice);
  if (dataTheme) document.documentElement.dataset.theme = dataTheme;
  else delete document.documentElement.dataset.theme;
}

/**
 * O botão "Tema" da barra superior (design-system.md, seções 2.1 e 4.1), com o ícone da escolha atual, e
 * o menu com claro, escuro e sistema.
 */
export function ThemeMenu({ choice: serverChoice }: Readonly<{ choice: ThemeChoice }>) {
  // A escolha local responde na hora, e a do servidor a substitui quando muda, como a feita em outra aba.
  const [choice, setChoice] = useState(serverChoice);
  const [lastServerChoice, setLastServerChoice] = useState(serverChoice);
  if (serverChoice !== lastServerChoice) {
    setLastServerChoice(serverChoice);
    setChoice(serverChoice);
  }
  const Icon = OPTIONS[choice].icon;
  return (
    <DropdownMenu.Root modal={false}>
      <Hint label="Tema" expanded={false} side="bottom">
        <DropdownMenu.Trigger
          aria-label="Tema"
          className={`inline-flex ${TOP_BAR_ICON_BUTTON} aria-expanded:bg-accent-soft`}
        >
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="bottom" align="end" sideOffset={8} className={MENU_PANEL}>
          <DropdownMenu.Label className={MENU_LABEL}>Tema</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={choice}
            onValueChange={(value) => {
              const next = themeChoiceOf(value);
              applyTheme(next);
              setChoice(next);
            }}
          >
            {THEME_CHOICES.map((value) => {
              const { label, icon: OptionIcon } = OPTIONS[value];
              return (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  className={`${MENU_ITEM} data-[state=checked]:bg-accent-soft`}
                >
                  <OptionIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                  {label}
                  <DropdownMenu.ItemIndicator className="ml-auto inline-flex">
                    <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
