import { Decimal } from '@prisma/client/runtime/library';

/**
 * Converte Decimal do Prisma para number JavaScript com segurança.
 * Evita NaN em operações aritméticas como reduce/sum.
 */
export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return new Decimal(value).toNumber();
}

/**
 * Soma um array de Decimal/number de forma segura.
 */
export function sumDecimals(values: Array<Decimal | number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + toNumber(v), 0);
}
