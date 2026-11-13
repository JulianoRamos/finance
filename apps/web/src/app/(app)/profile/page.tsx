import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { currentSession, listSessions } from '@/api/sessions';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { Card, PageBody, PageHeader } from '../../_shell/app-shell';
import { ChangePasswordForm } from './change-password-form';
import { SessionsTable } from './sessions-table';

export const metadata: Metadata = { title: 'Minha conta · finance' };

/** Minha conta: as sessões ativas do usuário e a troca de senha. */
export default async function Profile() {
  await connection();
  const [session, list] = await Promise.all([currentSession(), listSessions()]);
  if (session.status === 'unauthenticated' || list.status === 'unauthenticated') redirect('/login');

  return (
    <>
      <PageHeader title="Minha conta">
        {session.status === 'authenticated' && `${session.user.email} · as suas sessões e a sua senha.`}
      </PageHeader>
      <PageBody>
        <Card>
          <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="sessions-title" className="text-heading-md text-ink">
                Sessões ativas
              </h2>
              <p>Encerre uma sessão para cortar o acesso daquele aparelho na hora.</p>
            </div>
            {list.status === 'ok' ? (
              <SessionsTable sessions={list.sessions} labelledBy="sessions-title" />
            ) : (
              <ErrorNotice>
                <span className="flex flex-wrap items-center gap-3">
                  Não foi possível carregar as sessões.
                  {/* Um link comum, e não o do Next, para a página ser pedida de novo ao servidor. */}
                  <a
                    href="/profile"
                    className={`inline-flex h-8 items-center rounded-sm border border-hairline-strong bg-surface px-3 text-label text-ink hover:bg-surface-subtle ${FOCUS_RING}`}
                  >
                    Tentar de novo
                  </a>
                </span>
              </ErrorNotice>
            )}
            <p className="text-body-sm text-mute">
              Uma sessão expira depois de 7 dias sem uso e, de qualquer forma, 30 dias depois do login.
            </p>
          </section>
          <section
            aria-labelledby="password-title"
            className="flex max-w-section flex-col gap-4 border-t border-hairline pt-6"
          >
            <div className="flex flex-col gap-1">
              <h2 id="password-title" className="text-heading-md text-ink">
                Trocar a senha
              </h2>
              <p>A troca encerra as suas outras sessões. Esta continua aberta.</p>
            </div>
            <ChangePasswordForm />
          </section>
        </Card>
      </PageBody>
    </>
  );
}
