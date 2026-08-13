import { Controller, Post, Body, Sse, Inject, type MessageEvent } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { AgentService } from './agent.service.js'

interface ChatDto {
    message: string
}

@Controller('chat')
export class ChatController {
    constructor(@Inject(AgentService) private readonly agentService: AgentService) {
        this.agentService = agentService
    }

    @Post('stream')
    @Sse()
    streamChat(@Body() body: ChatDto): Observable<MessageEvent> {
        console.log(this.agentService)
        return this.agentService.streamAgentEvents(body.message).pipe(
            map((event) => ({
                data: JSON.stringify(event),
            }))
        );
    }
}