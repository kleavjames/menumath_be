import { BadRequestException } from '@nestjs/common';
import { Unit } from '../generated/prisma/client.js';

/**
 * Smaller unit used to store `usableCostPerItem`, matching the app's unit options.
 * e.g. a 1 kg pack priced at 10 is stored as 0.01 per g.
 */
const UNIT_SUB_UNITS: Partial<Record<Unit, { unit: Unit; perUnit: number }>> = {
  [Unit.KG]: { unit: Unit.G, perUnit: 1000 },
  [Unit.L]: { unit: Unit.ML, perUnit: 1000 },
  [Unit.OZ]: { unit: Unit.LB, perUnit: 16 },
  [Unit.GAL]: { unit: Unit.OZ, perUnit: 128 },
  [Unit.LB]: { unit: Unit.OZ, perUnit: 16 },
};

export type SupplierCostInput = {
  itemSize: unknown;
  itemPrice: unknown;
  itemSizeUnit: Unit;
};

export type RecipeTotals = {
  costPerServing: number;
  recipeCost: number;
  profit: number;
  margin: number;
};

export function decimalToNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value !== null) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundTo2(value: number): number {
  return roundTo(value, 2);
}

export function getCostUnit(itemSizeUnit: Unit): Unit {
  return UNIT_SUB_UNITS[itemSizeUnit]?.unit ?? itemSizeUnit;
}

/**
 * Cost of one use-unit of the pack (subunit when the pack unit has one).
 * 1 kg at 10 → 0.01 per g. 500 g at 5 → 0.01 per g.
 */
export function computeUsableCostPerItem(
  itemSize: number,
  itemPrice: number,
  itemSizeUnit: Unit,
): number {
  if (!(itemSize > 0)) {
    throw new BadRequestException('Pack size must be greater than 0');
  }
  if (!(itemPrice > 0)) {
    throw new BadRequestException('Pack price must be greater than 0');
  }

  const perPackUnit = itemPrice / itemSize;
  const subUnit = UNIT_SUB_UNITS[itemSizeUnit];
  return subUnit ? perPackUnit / subUnit.perUnit : perPackUnit;
}

export function storedUsableCostPerItem(
  itemSize: number,
  itemPrice: number,
  itemSizeUnit: Unit,
): number {
  return roundTo(
    computeUsableCostPerItem(itemSize, itemPrice, itemSizeUnit),
    4,
  );
}

export function computeRecipeLineCost(
  quantity: unknown,
  supplier: SupplierCostInput,
): number {
  const usableCost = computeUsableCostPerItem(
    decimalToNumber(supplier.itemSize),
    decimalToNumber(supplier.itemPrice),
    supplier.itemSizeUnit,
  );
  return roundTo2(decimalToNumber(quantity) * usableCost);
}

export function computeRecipeTotals(args: {
  servings: number;
  pricePerServing: unknown;
  lineCosts: unknown[];
}): RecipeTotals {
  const servings = Math.max(args.servings, 1);
  const pricePerServing = decimalToNumber(args.pricePerServing);
  const batchCost = args.lineCosts.reduce<number>(
    (sum, lineCost) => sum + decimalToNumber(lineCost),
    0,
  );
  const costPerServing = roundTo2(batchCost / servings);
  const hasPrice = pricePerServing > 0;
  const profit = hasPrice ? roundTo2(pricePerServing - costPerServing) : 0;
  const recipeCost = hasPrice
    ? roundTo2((costPerServing / pricePerServing) * 100)
    : 0;
  const margin = hasPrice ? roundTo2((profit / pricePerServing) * 100) : 0;

  return {
    costPerServing,
    recipeCost,
    profit,
    margin,
  };
}
