import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from '../common/audit/audit-log.entity.js';
import { AuditService } from '../common/audit/audit.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { Article, ArticleStatus } from './entities/article.entity.js';

export interface RequestMeta {
  ip: string;
  userAgent?: string;
  user?: { id: string; email: string; role: string };
}

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    private readonly audit: AuditService,
  ) {}

  // ── Public ─────────────────────────────────────────────────────

  async findAllPublished(): Promise<Article[]> {
    return this.articleRepo.find({
      where: { status: ArticleStatus.PUBLISHED },
      order: { publishedAt: 'DESC' },
      select: [
        'id',
        'title',
        'slug',
        'excerpt',
        'coverImageUrl',
        'publishedAt',
        'createdAt',
      ],
    });
  }

  async findPublishedBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { slug, status: ArticleStatus.PUBLISHED },
    });
    if (!article) {
      throw new NotFoundException(`Article not found`);
    }
    return article;
  }

  // ── Admin ──────────────────────────────────────────────────────

  async findAll(meta: RequestMeta): Promise<Article[]> {
    await this.audit.log({
      action: AuditAction.BLOG_ACCESS_LIST,
      resource: 'article',
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.articleRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, meta: RequestMeta): Promise<Article> {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    await this.audit.log({
      action: AuditAction.BLOG_ACCESS_DETAIL,
      resource: 'article',
      resourceId: id,
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return article;
  }

  async create(dto: CreateArticleDto, meta: RequestMeta): Promise<Article> {
    const slug = this.generateSlug(dto.title);

    const existing = await this.articleRepo.findOne({ where: { slug } });
    if (existing) {
      throw new NotFoundException(
        `An article with a similar title already exists`,
      );
    }

    const article = this.articleRepo.create({
      ...dto,
      slug,
      createdBy: meta.user!.id,
      publishedAt: dto.status === ArticleStatus.PUBLISHED ? new Date() : null,
    });

    const saved = await this.articleRepo.save(article);

    await this.audit.log({
      action: AuditAction.BLOG_CREATED,
      resource: 'article',
      resourceId: saved.id,
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    meta: RequestMeta,
  ): Promise<Article> {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    if (dto.title && dto.title !== article.title) {
      const slug = this.generateSlug(dto.title);
      const existing = await this.articleRepo.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new NotFoundException(
          `An article with a similar title already exists`,
        );
      }
      article.slug = slug;
    }

    // Handle publish transition
    if (
      dto.status === ArticleStatus.PUBLISHED &&
      article.status !== ArticleStatus.PUBLISHED
    ) {
      article.publishedAt = new Date();
    }

    Object.assign(article, dto);
    article.updatedBy = meta.user!.id;

    const saved = await this.articleRepo.save(article);

    await this.audit.log({
      action: AuditAction.BLOG_UPDATED,
      resource: 'article',
      resourceId: saved.id,
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return saved;
  }

  async remove(id: string, meta: RequestMeta): Promise<void> {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    await this.articleRepo.softDelete(id);

    await this.audit.log({
      action: AuditAction.BLOG_DELETED,
      resource: 'article',
      resourceId: id,
      userId: meta.user!.id,
      userEmail: meta.user!.email,
      userRole: meta.user!.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
