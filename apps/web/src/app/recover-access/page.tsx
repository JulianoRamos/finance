import type { Metadata } from 'next';
import Link from 'next/link';

import { AccessHeading, AccessScreen, SECONDARY_LINK } from '../_access/access-screen';

export const metadata: Metadata = { title: 'Recuperar o acesso' };

const STEPS = [
  <>
    Peça a quem gere os acessos que abra <strong className="text-label text-ink">Usuários e acessos</strong>, escolha o
    seu usuário e gere um link de recuperação.
  </>,
  <>Abra o link em até 1 hora e defina a nova senha. Ele vale uma vez só.</>,
  <>Ao salvar, todas as suas sessões abertas são encerradas e você entra de novo.</>,
];

export default function RecoverAccessPage() {
  return (
    <AccessScreen>
      <div className="flex flex-col gap-6">
        <AccessHeading title="Recuperar o acesso">
          O Finance não envia e-mail. A recuperação é feita por um link que outra pessoa da casa gera para você.
        </AccessHeading>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-6 flex-none items-center justify-center rounded-full bg-surface-subtle text-body-sm font-medium text-ink"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4">
          <span className="text-label text-ink">Ninguém consegue entrar?</span>
          <span>Quem cuida do servidor gera o link pelo comando de recuperação de acesso.</span>
        </div>
        <Link href="/login" className={SECONDARY_LINK}>
          Voltar para o login
        </Link>
      </div>
    </AccessScreen>
  );
}
