import type { CategoryType } from '../../generated/prisma/client.js';

export class CreateCategoryDto {
  name: string;
  type: CategoryType;
  businessId: string;
}
