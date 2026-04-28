import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { IsString, IsUUID } from 'class-validator';

class ChatDto {
  @IsString() message: string;
  @IsUUID() farm_id: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto.message, dto.farm_id);
  }
}
