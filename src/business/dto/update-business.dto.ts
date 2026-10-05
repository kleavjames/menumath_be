import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateBusinessDto } from './create-business.dto.js';

export class UpdateBusinessDto extends PartialType(
  OmitType(CreateBusinessDto, ['ownerUserId'] as const),
) {}
