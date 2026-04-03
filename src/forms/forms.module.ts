import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactSubmission } from './entities/contact-submission.entity.js';
import { FormsController } from './forms.controller.js';
import { FormsService } from './forms.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ContactSubmission])],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
