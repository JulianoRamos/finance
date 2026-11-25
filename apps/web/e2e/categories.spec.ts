import { expect, type Locator, test } from '@playwright/test';

import { createTestIndividual, uniqueName } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

/** A linha da árvore com o nome dado, achada pelo texto, e não pela posição: a árvore é de todos os testes. */
function row(tree: Locator, name: string): Locator {
  return tree.getByRole('row').filter({ hasText: name });
}

test(
  'o usuário cria, renomeia, busca e desativa categorias na árvore',
  { tag: '@KAN-27-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    await createTestIndividual(user, uniqueName('Ana Categorias'));
    await signIn(page.context(), user, baseURL ?? '');
    const marker = uniqueName('Cat').replaceAll(' ', '');
    const parentName = `${marker} Casa`;
    const childName = `${marker} Luz`;
    const renamed = `${marker} Energia`;
    const tree = page.getByRole('treegrid', { name: 'Categorias de despesa' });
    const search = page.getByRole('searchbox', { name: 'Buscar categoria' });

    await page.goto('/');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Categorias' }).click();
    await expect(page.getByRole('tab', { name: 'Despesas' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Nova categoria' }).click();
    const newCategory = page.getByRole('dialog', { name: 'Nova categoria' });
    await expect(newCategory.getByRole('radio', { name: 'Despesa' })).toBeChecked();
    await newCategory.getByLabel('Nome').fill(parentName);
    await newCategory.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(newCategory).toHaveCount(0);

    // A categoria nova pode não estar na primeira página: a busca a traz.
    await search.fill(marker);
    await expect(row(tree, parentName)).toBeVisible();
    await row(tree, parentName)
      .getByRole('button', { name: `Nova subcategoria em ${parentName}` })
      .click();
    const newChild = page.getByRole('dialog', { name: `Nova subcategoria em ${parentName}` });
    await newChild.getByLabel('Nome').fill(childName);
    await newChild.getByRole('button', { name: 'Criar subcategoria' }).click();
    await expect(newChild).toHaveCount(0);
    await expect(row(tree, childName)).toHaveAttribute('aria-level', '2');

    await row(tree, childName)
      .getByRole('button', { name: `Ações de ${childName}` })
      .click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    const nameField = page.getByLabel(`Novo nome de ${parentName} › ${childName}`);
    await expect(nameField).toBeFocused();
    await nameField.fill(renamed);
    await nameField.press('Enter');
    await expect(row(tree, renamed)).toHaveAttribute('aria-level', '2');
    await expect(row(tree, childName)).toHaveCount(0);

    await search.fill(renamed);
    const found = row(tree, renamed);
    await expect(found.locator('mark')).toHaveText(renamed);
    await expect(row(tree, parentName)).toContainText('categoria pai');
    await expect(row(tree, parentName)).toHaveAttribute('aria-level', '1');

    await search.fill(marker);
    await row(tree, parentName)
      .getByRole('button', { name: `Ações de ${parentName}` })
      .click();
    await page.getByRole('menuitem', { name: 'Desativar categoria' }).click();
    const confirmation = page.getByRole('alertdialog', { name: `Desativar a categoria ${parentName}?` });
    await confirmation.getByRole('button', { name: 'Desativar categoria' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(row(tree, parentName)).toContainText('Desativada');
    await expect(row(tree, renamed)).toContainText('Desativada');
  },
);
