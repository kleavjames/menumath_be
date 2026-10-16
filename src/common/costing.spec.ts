import { BadRequestException } from '@nestjs/common';
import { Unit } from '../generated/prisma/client.js';
import {
  computeRecipeLineCost,
  computeRecipeTotals,
  computeUsableCostPerItem,
  decimalToNumber,
  getCostUnit,
  storedUsableCostPerItem,
} from './costing.js';

describe('costing', () => {
  describe('computeUsableCostPerItem', () => {
    it('stores kg pack cost per gram', () => {
      expect(computeUsableCostPerItem(1, 10, Unit.KG)).toBeCloseTo(0.01);
      expect(getCostUnit(Unit.KG)).toBe(Unit.G);
      expect(storedUsableCostPerItem(1, 10, Unit.KG)).toBe(0.01);
    });

    it('stores liter pack cost per milliliter', () => {
      expect(computeUsableCostPerItem(2, 8, Unit.L)).toBeCloseTo(0.004);
    });

    it('uses pack unit when there is no subunit', () => {
      expect(computeUsableCostPerItem(500, 5, Unit.G)).toBeCloseTo(0.01);
      expect(computeUsableCostPerItem(1, 3, Unit.EACH)).toBe(3);
      expect(getCostUnit(Unit.EACH)).toBe(Unit.EACH);
    });

    it('rejects non-positive pack size and price', () => {
      expect(() => computeUsableCostPerItem(0, 10, Unit.KG)).toThrow(
        BadRequestException,
      );
      expect(() => computeUsableCostPerItem(1, 0, Unit.KG)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('computeRecipeLineCost', () => {
    it('multiplies quantity by usable cost', () => {
      expect(
        computeRecipeLineCost(200, {
          itemSize: 1,
          itemPrice: 10,
          itemSizeUnit: Unit.KG,
        }),
      ).toBe(2);
    });

    it('accepts decimal-like quantity strings', () => {
      expect(
        computeRecipeLineCost('150', {
          itemSize: '1',
          itemPrice: '6',
          itemSizeUnit: Unit.L,
        }),
      ).toBe(0.9);
    });
  });

  describe('computeRecipeTotals', () => {
    it('computes serving cost, food cost %, profit, and margin', () => {
      expect(
        computeRecipeTotals({
          servings: 2,
          pricePerServing: 8,
          lineCosts: [6, 4],
        }),
      ).toEqual({
        costPerServing: 5,
        recipeCost: 62.5,
        profit: 3,
        margin: 37.5,
      });
    });

    it('zeros food cost, profit, and margin when price is 0', () => {
      expect(
        computeRecipeTotals({
          servings: 1,
          pricePerServing: 0,
          lineCosts: [4],
        }),
      ).toEqual({
        costPerServing: 4,
        recipeCost: 0,
        profit: 0,
        margin: 0,
      });
    });
  });

  describe('decimalToNumber', () => {
    it('parses numbers, numeric strings, and decimal-like objects', () => {
      expect(decimalToNumber(1.5)).toBe(1.5);
      expect(decimalToNumber('2.25')).toBe(2.25);
      expect(decimalToNumber({ toString: () => '3.5' })).toBe(3.5);
      expect(decimalToNumber(undefined)).toBe(0);
    });
  });
});
