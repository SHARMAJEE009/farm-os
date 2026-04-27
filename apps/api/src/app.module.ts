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
  ],
})
export class AppModule {}
