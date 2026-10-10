import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BusinessModule } from './business/business.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { IngredientsModule } from './ingredients/ingredients.module.js';
import { RecipesModule } from './recipes/recipes.module.js';

@Module({
  imports: [PrismaModule, UsersModule, BusinessModule, AuthModule, CategoriesModule, IngredientsModule, RecipesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
