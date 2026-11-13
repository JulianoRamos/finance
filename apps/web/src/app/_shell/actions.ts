'use server';

import { redirect } from 'next/navigation';

import { clearSession } from '@/api/session-cookie';
import { endCurrentSession } from '@/api/sessions';

/** Sai: encerra a sessão na api, apaga o cookie mesmo quando a api não responde e vai para o login. */
export async function logoutAction(): Promise<void> {
  await endCurrentSession();
  await clearSession();
  redirect('/login');
}
