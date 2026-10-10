import { CreateUpdateRecipeIngredientDto } from './create-update-recipe-ingredient.dto.js';
import { RecipeStepDto } from './recipe-step.dto.js';

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
  steps?: RecipeStepDto[];
}
