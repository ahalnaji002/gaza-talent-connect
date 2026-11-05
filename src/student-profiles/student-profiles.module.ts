import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentProfilesController } from './student-profiles.controller';
import { StudentProfilesService } from './student-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [StudentProfilesController],
  providers: [StudentProfilesService],
})
export class StudentProfilesModule {}
