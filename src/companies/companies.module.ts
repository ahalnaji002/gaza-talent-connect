import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  CompaniesController,
  CompanyFeedbackController,
  StudentFeedbackController,
} from './companies.controllers';
import { CompanyFeedbackService } from './company-feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [
    CompaniesController,
    CompanyFeedbackController,
    StudentFeedbackController,
  ],
  providers: [CompanyFeedbackService],
})
export class CompaniesModule {}
