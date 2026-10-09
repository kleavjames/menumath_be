import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { IngredientsService } from './ingredients.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

@Controller('ingredients')
@UseGuards(JwtAuthGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() createIngredientDto: CreateIngredientDto,
  ) {
    return this.ingredientsService.create(user.id, createIngredientDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('businessId') businessId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('businessId query parameter is required');
    }

    return this.ingredientsService.findAll(user.id, businessId, categoryId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ingredientsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateIngredientDto: UpdateIngredientDto,
  ) {
    return this.ingredientsService.update(user.id, id, updateIngredientDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ingredientsService.remove(user.id, id);
  }
}
