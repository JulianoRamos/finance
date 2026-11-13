import Link from 'next/link';

import { AccessHeading, SECONDARY_LINK } from '../../_access/access-screen';
import { Icon } from '../../_access/icon';

/** O link que não vale mais: venceu ou já foi usado, sem dizer qual dos dois. */
export function ExpiredLink() {
  return (
    <div className="flex flex-col items-center gap-6">
      <Icon size={32} className="text-warning">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </Icon>
      <AccessHeading title="Este link não vale mais">
        Ele venceu ou já foi usado. Peça um novo link a quem gere os acessos.
      </AccessHeading>
      <Link href="/login" className={SECONDARY_LINK}>
        Voltar para o login
      </Link>
    </div>
  );
}
