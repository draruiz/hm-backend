import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogController } from './blog.controller.js';
import { BlogService } from './blog.service.js';
import { Article } from './entities/article.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
