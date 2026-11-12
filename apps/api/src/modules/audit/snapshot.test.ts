import { describe, expect, it } from 'vitest';

import { Decimal } from '../../common/index.js';
import { toSnapshot } from './snapshot.js';

describe('toSnapshot', () => {
  it('retira os campos sensíveis', { tags: ['@KAN-8-CA4'] }, () => {
    const record = {
      id: '0b9c6f0e-3d43-4c0a-9a57-3f1f4c2b8e11',
      name: 'Maria',
      email: 'maria@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc',
      totpSecretEncrypted: 'cifrado',
      tokenHash: 'a1b2c3',
      codeHash: 'd4e5f6',
      newPassword: 'segredo123',
      // O nome da coluna, como o $queryRaw o lê.
      code_hash: 'g7h8i9',
    };

    expect(toSnapshot(record)).toEqual({
      id: '0b9c6f0e-3d43-4c0a-9a57-3f1f4c2b8e11',
      name: 'Maria',
      email: 'maria@example.com',
    });
  });

  it('converte os valores para JSON', { tags: ['@KAN-8-CA4'] }, () => {
    const record = {
      id: '5f1d2a4e-8c7b-4e3a-b1f0-2d9e6c4a7b38',
      description: 'Mercado',
      amount: new Decimal('1234.56'),
      quantity: new Decimal('0.125'),
      // Uma data de calendário (coluna date), como o Prisma a lê: meia-noite em UTC.
      occurredOn: new Date('2026-03-05T00:00:00.000Z'),
      // Um instante (coluna timestamptz, nome terminado em At).
      createdAt: new Date('2026-03-05T15:04:05.678Z'),
      canceledAt: null,
      active: true,
      number: 3,
      sequence: 9007199254740993n,
      // Um instante com o nome da coluna, como o $queryRaw o lê.
      expires_at: new Date('2026-03-06T08:00:00.000Z'),
    };

    expect(JSON.parse(JSON.stringify(toSnapshot(record)))).toEqual({
      id: '5f1d2a4e-8c7b-4e3a-b1f0-2d9e6c4a7b38',
      description: 'Mercado',
      amount: '1234.56',
      quantity: '0.125',
      occurredOn: '2026-03-05',
      createdAt: '2026-03-05T15:04:05.678Z',
      canceledAt: null,
      active: true,
      number: 3,
      sequence: '9007199254740993',
      expires_at: '2026-03-06T08:00:00.000Z',
    });
  });
});
