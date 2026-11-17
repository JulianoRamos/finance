import { expect, test } from '@playwright/test';

import { createTestCompany, createTestIndividual, findEntityOption } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

test(
  'na tela da empresa, o usuário vê, registra e encerra as participações dela',
  { tag: '@KAN-15-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    const company = await createTestCompany(user);
    const person = await createTestIndividual(user);
    await signIn(page.context(), user, baseURL ?? '');
    const section = page.getByRole('region', { name: 'Participações societárias' });

    await page.goto(`/entities/${company.id}`);
    await expect(section).toContainText('Nenhuma participação registrada.');

    await section.getByRole('button', { name: 'Registrar participação' }).click();
    const form = section.getByRole('form', { name: 'Registrar participação' });
    await findEntityOption(form, person.name);
    await form.getByRole('radio', { name: person.name }).check();
    await form.getByLabel('Fração (%)').fill('60');
    await form.getByLabel('Início').fill('2022-03-01');
    await form.getByRole('button', { name: 'Registrar', exact: true }).click();

    // A linha da tabela ou, numa seção estreita, o item da lista: só o visível está na árvore de acessibilidade.
    const row = section
      .getByRole('row', { name: new RegExp(person.name) })
      .or(section.getByRole('listitem').filter({ hasText: person.name }));
    await expect(row).toContainText('60,0%');
    await expect(row).toContainText('desde 01/03/2022');

    await row.getByRole('button', { name: `Encerrar a participação de ${person.name}` }).click();
    const endForm = section.getByRole('form', { name: new RegExp(`Encerrar a participação de ${person.name}`) });
    await endForm.getByLabel('Último dia').fill('2026-11-30');
    await endForm.getByRole('button', { name: 'Encerrar participação' }).click();

    await expect(row).toContainText('01/03/2022 a 30/11/2026');
    await expect(row.getByRole('button', { name: /Encerrar/ })).toHaveCount(0);

    await page.goto(`/entities/${person.id}`);
    await expect(page.getByRole('heading', { level: 2, name: person.name })).toBeVisible();
    await expect(section).toHaveCount(0);
  },
);
