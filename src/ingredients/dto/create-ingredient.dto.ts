import { IngredientSupplierDto } from './ingredient-supplier.dto.js';

export class CreateIngredientDto {
  businessId: string;
  categoryId: string;
  name: string;
  suppliers: IngredientSupplierDto[];
  /** Supplier id to use for recipe cost calculations; defaults to the first supplier if omitted. */
  calculationSupplierId?: string;
}
