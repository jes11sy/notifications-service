import { Module, OnModuleInit } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule implements OnModuleInit {
  constructor(private templatesService: TemplatesService) {}

  async onModuleInit() {
    // Инициализируем шаблоны по умолчанию при старте
    await this.templatesService.initializeDefaultTemplates();
  }
}

