import type { CategoryType } from '../../generated/prisma/client.js';

export class UpdateCategoryDto {
  name?: string;
  type?: CategoryType;
}
