import type { Metadata } from 'next';

import { AccessScreen } from '../_access/access-screen';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar no Finance' };

export default function LoginPage() {
  return (
    <AccessScreen>
      <LoginForm />
    </AccessScreen>
  );
}
