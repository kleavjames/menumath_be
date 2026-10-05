import type {
  BusinessType,
  Currency,
  UnitSystem,
} from '../../generated/prisma/client.js';

/** Business fields used when creating an owner account. */
export class OwnerBusinessDto {
  name: string;
  type: BusinessType;
  currency: Currency;
  targetFoodCost: number;
  unitSystem?: UnitSystem;
}
