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
import { RecipesService } from './recipes.service.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';

@Controller('recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() createRecipeDto: CreateRecipeDto,
  ) {
    return this.recipesService.create(user.id, createRecipeDto);
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

    return this.recipesService.findAll(user.id, businessId, categoryId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recipesService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ) {
    return this.recipesService.update(user.id, id, updateRecipeDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.recipesService.remove(user.id, id);
  }
}
