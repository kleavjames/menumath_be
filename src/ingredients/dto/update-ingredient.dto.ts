import type { IngredientSupplierDto } from './ingredient-supplier.dto.js';

export class UpdateIngredientDto {
  categoryId?: string;
  name?: string;
  suppliers?: IngredientSupplierDto[];
  calculationSupplierId?: string;
}
