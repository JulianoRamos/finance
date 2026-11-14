import { describe, expect, it } from 'vitest';

import { isValidTaxId, normalizeTaxId } from './tax-id.js';

describe('normalizeTaxId', () => {
  it('tira a pontuação e os espaços e põe as letras em maiúsculas', () => {
    expect(normalizeTaxId('529.982.247-25')).toBe('52998224725');
    expect(normalizeTaxId(' 00.000.000/0001-91 ')).toBe('00000000000191');
    expect(normalizeTaxId('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  it('o documento vazio ou ausente fica nulo', () => {
    expect(normalizeTaxId('')).toBeNull();
    expect(normalizeTaxId('  ')).toBeNull();
    expect(normalizeTaxId(null)).toBeNull();
    expect(normalizeTaxId(undefined)).toBeNull();
  });
});

describe('isValidTaxId', () => {
  it('aceita o CPF com os dígitos verificadores certos na pessoa física', () => {
    expect(isValidTaxId('individual', '52998224725')).toBe(true);
    expect(isValidTaxId('individual', '11144477735')).toBe(true);
  });

  it('recusa o CPF com um dígito verificador errado', () => {
    expect(isValidTaxId('individual', '52998224724')).toBe(false);
    expect(isValidTaxId('individual', '52998224715')).toBe(false);
  });

  it('recusa o CPF de algarismos todos iguais, o de tamanho errado e o com letras', () => {
    expect(isValidTaxId('individual', '11111111111')).toBe(false);
    expect(isValidTaxId('individual', '5299822472')).toBe(false);
    expect(isValidTaxId('individual', '5299822472A')).toBe(false);
  });

  it('aceita o CNPJ numérico e o alfanumérico na pessoa jurídica', () => {
    expect(isValidTaxId('company', '00000000000191')).toBe(true);
    expect(isValidTaxId('company', '11222333000181')).toBe(true);
    // O exemplo da Receita do CNPJ alfanumérico.
    expect(isValidTaxId('company', '12ABC34501DE35')).toBe(true);
  });

  it('recusa o CNPJ com um dígito verificador errado', () => {
    expect(isValidTaxId('company', '00000000000192')).toBe(false);
    expect(isValidTaxId('company', '12ABC34501DE53')).toBe(false);
  });

  it('recusa o CNPJ de caracteres todos iguais e o com letra nos dígitos verificadores', () => {
    expect(isValidTaxId('company', '00000000000000')).toBe(false);
    expect(isValidTaxId('company', '12ABC34501DE3A')).toBe(false);
  });

  it('recusa o documento do outro tipo', () => {
    expect(isValidTaxId('company', '52998224725')).toBe(false);
    expect(isValidTaxId('individual', '00000000000191')).toBe(false);
  });
});
