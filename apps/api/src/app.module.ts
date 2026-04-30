import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './common/auth/auth.module';
import { FarmsModule } from './modules/farms/farms.module';
import { PaddocksModule } from './modules/paddocks/paddocks.module';
import { UsersModule } from './modules/users/users.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { FuelLogsModule } from './modules/fuel-logs/fuel-logs.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { SupplierOrdersModule } from './modules/supplier-orders/supplier-orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FinancialTransactionsModule } from './modules/financial-transactions/financial-transactions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NewsModule } from './modules/news/news.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { LivestockMasterModule } from './modules/livestock-master/livestock-master.module';
import { MobModule } from './modules/mob/mob.module';
import { MobAssignmentModule } from './modules/mob-assignment/mob-assignment.module';
import { HealthEventModule } from './modules/health-event/health-event.module';
import { WeighEventModule } from './modules/weigh-event/weigh-event.module';
import { AiModule } from './modules/ai/ai.module';
// Agworld feature modules
import { ActivitiesModule } from './modules/activities/activities.module';
import { ProductsModule } from './modules/products/products.module';
import { CropPlansModule } from './modules/crop-plans/crop-plans.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { WeatherModule } from './modules/weather/weather.module';
import { HarvestModule } from './modules/harvest/harvest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    FarmsModule,
    PaddocksModule,
    TimesheetsModule,
    FuelLogsModule,
    RecommendationsModule,
    SupplierOrdersModule,
    PaymentsModule,
    FinancialTransactionsModule,
    DashboardModule,
    NewsModule,
    ChatbotModule,
    LivestockMasterModule,
    MobModule,
    MobAssignmentModule,
    HealthEventModule,
    WeighEventModule,
    AiModule,
    // Agworld feature modules
    ActivitiesModule,
    ProductsModule,
    CropPlansModule,
    InventoryModule,
    TasksModule,
    WeatherModule,
    HarvestModule,
  ],
})
export class AppModule {}
