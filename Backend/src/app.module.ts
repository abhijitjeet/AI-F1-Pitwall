import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { AgentService } from './agent.service.js';

@Module({
    controllers: [ChatController],
    providers: [AgentService],
})
export class AppModule { }