import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto.js';
import type { RequestMeta } from './forms.service.js';
import { FormsService } from './forms.service.js';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  /**
   * Public endpoint – landing page contact form.
   * No auth required. Rate-limited to 5 requests per 60 seconds per IP.
   */
  @Public()
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async submitContact(
    @Body() dto: CreateContactSubmissionDto,
    @Req() req: Request,
  ) {
    const result = await this.formsService.createSubmission(dto, {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
    });
    return {
      message:
        'Your information has been securely received and encrypted. We will contact you soon.',
      id: result.id,
      createdAt: result.createdAt,
    };
  }

  /**
   * Admin endpoint – list all contact submissions (decrypted).
   * Requires JWT + admin role.
   */
  @Get('contact/submissions')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async listSubmissions(@Req() req: Request) {
    return this.formsService.findAllSubmissions({
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
      user: req.user as RequestMeta['user'],
    });
  }

  /**
   * Admin endpoint – view single submission (decrypted).
   * Requires JWT + admin role.
   */
  @Get('contact/submissions/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.formsService.findOneSubmission(id, {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
      user: req.user as RequestMeta['user'],
    });
  }
}
