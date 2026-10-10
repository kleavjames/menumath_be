import { CreateUpdateRecipeIngredientDto } from './create-update-recipe-ingredient.dto.js';

export class UpdateRecipeDto {
  categoryId?: string;
  name?: string;
  servings?: number;
  pricePerServing?: number;
  costPerServing?: number;
  recipeCost?: number;
  profit?: number;
  margin?: number;
  ingredients?: CreateUpdateRecipeIngredientDto[];
}
