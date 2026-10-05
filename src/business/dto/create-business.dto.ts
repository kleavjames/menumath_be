import type {
  BusinessType,
  Currency,
  UnitSystem,
} from '../../generated/prisma/client.js';

export class CreateBusinessDto {
  name: string;
  type: BusinessType;
  currency: Currency;
  targetFoodCost: number;
  unitSystem?: UnitSystem;
}
