import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { RequestMeta } from './blog.service.js';
import { BlogService } from './blog.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ── Public endpoints ──────────────────────────────────────────

  @Public()
  @Get('articles')
  findAllPublished() {
    return this.blogService.findAllPublished();
  }

  @Public()
  @Get('articles/:slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.blogService.findPublishedBySlug(slug);
  }

  // ── Admin endpoints ───────────────────────────────────────────

  @Get('admin/articles')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll(@Req() req: Request) {
    return this.blogService.findAll(this.extractMeta(req));
  }

  @Get('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.blogService.findOne(id, this.extractMeta(req));
  }

  @Post('admin/articles')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateArticleDto, @Req() req: Request) {
    return this.blogService.create(dto, this.extractMeta(req));
  }

  @Patch('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: Request,
  ) {
    return this.blogService.update(id, dto, this.extractMeta(req));
  }

  @Delete('admin/articles/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.blogService.remove(id, this.extractMeta(req));
  }

  // ── Helpers ───────────────────────────────────────────────────

  private extractMeta(req: Request): RequestMeta {
    return {
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'],
      user: req.user as RequestMeta['user'],
    };
  }
}
