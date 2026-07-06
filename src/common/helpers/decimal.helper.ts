import { Prisma } from '@prisma/client';

/**
 * Converte Prisma Decimal para number JavaScript de forma segura.
 * Usar em todo cálculo de receita/preço.
 */
export function toNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

export function sumDecimals(values: (Prisma.Decimal | null | undefined)[]): number {
  return values.reduce((acc, v) => acc + toNumber(v), 0);
}
