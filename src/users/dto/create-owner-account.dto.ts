import { OwnerBusinessDto } from './owner-business.dto.js';

export class CreateOwnerAccountDto {
  fullName: string;
  username: string;
  password: string;
  business: OwnerBusinessDto;
}
