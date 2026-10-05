import { describe, it, expect } from 'vitest';
import { maskCPF, maskCNPJ, maskCEP, maskUF, maskCelular, maskTelefoneFixo } from '@/lib/masks';

describe('maskCPF', () => {
  it('formats a full CPF as ###.###.###-##', () => {
    expect(maskCPF('12345678900')).toBe('123.456.789-00');
  });

  it('formats partial input progressively', () => {
    expect(maskCPF('123')).toBe('123');
    expect(maskCPF('123456')).toBe('123.456');
    expect(maskCPF('123456789')).toBe('123.456.789');
  });

  it('ignores non-digit characters and extra digits beyond 11', () => {
    expect(maskCPF('123.456.789-001234')).toBe('123.456.789-00');
  });
});

describe('maskCNPJ', () => {
  it('formats a full CNPJ as ##.###.###/####-##', () => {
    expect(maskCNPJ('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('formats partial input progressively', () => {
    expect(maskCNPJ('12')).toBe('12');
    expect(maskCNPJ('12345')).toBe('12.345');
    expect(maskCNPJ('12345678')).toBe('12.345.678');
    expect(maskCNPJ('123456780001')).toBe('12.345.678/0001');
  });
});

describe('maskCEP', () => {
  it('formats as #####-###', () => {
    expect(maskCEP('01310100')).toBe('01310-100');
  });

  it('formats partial input progressively', () => {
    expect(maskCEP('013')).toBe('013');
    expect(maskCEP('01310')).toBe('01310');
  });
});

describe('maskUF', () => {
  it('uppercases and limits to 2 characters', () => {
    expect(maskUF('sp')).toBe('SP');
    expect(maskUF('spx')).toBe('SP');
  });

  it('strips non-letter characters', () => {
    expect(maskUF('s1p')).toBe('SP');
  });
});

describe('maskCelular', () => {
  it('formats as (##) #####-####', () => {
    expect(maskCelular('21999998888')).toBe('(21) 99999-8888');
  });

  it('formats partial input progressively', () => {
    expect(maskCelular('21')).toBe('21');
    expect(maskCelular('219')).toBe('(21) 9');
  });
});

describe('maskTelefoneFixo', () => {
  it('formats an 8-digit local number with DDD as (##) ####-####', () => {
    expect(maskTelefoneFixo('2133334444')).toBe('(21) 3333-4444');
  });

  it('formats a 9-digit local number with DDD as (##) #####-####', () => {
    expect(maskTelefoneFixo('21999998888')).toBe('(21) 99999-8888');
  });
});
