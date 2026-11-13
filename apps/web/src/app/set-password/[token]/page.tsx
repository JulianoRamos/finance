import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { lookUpRecoveryLink } from '@/api/sessions';

import { AccessHeading, AccessScreen, SECONDARY_LINK } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { ExpiredLink } from './expired-link';
import { SetPasswordForm } from './set-password-form';

export const metadata: Metadata = { title: 'Defina sua senha' };

/** A consulta do link recusada, como por tentativas demais: o link pode valer, então não se diz que venceu. */
function RefusedLink({ message }: Readonly<{ message: string }>) {
  return (
    <div className="flex flex-col gap-6">
      <AccessHeading title="Não foi possível abrir o link">Tente abrir o link de novo mais tarde.</AccessHeading>
      <ErrorNotice>{message}</ErrorNotice>
      <Link href="/login" className={SECONDARY_LINK}>
        Voltar para o login
      </Link>
    </div>
  );
}

export default async function SetPasswordPage({ params }: PageProps<'/set-password/[token]'>) {
  // O link é conferido a cada abertura: ele pode ter vencido ou sido usado desde a última.
  await connection();
  const { token } = await params;
  const link = await lookUpRecoveryLink(token);
  return (
    <AccessScreen>
      {link.status === 'valid' && <SetPasswordForm token={token} email={link.email} />}
      {link.status === 'invalid' && <ExpiredLink />}
      {link.status === 'refused' && <RefusedLink message={link.message} />}
    </AccessScreen>
  );
}
