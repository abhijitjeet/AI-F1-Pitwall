import { Injectable } from "@angular/core";
import { SSEEvent } from "../models/chat.model";

@Injectable({
    providedIn: 'root'
})

export class ChatService {
    private readonly API_URL = 'http://localhost:3000/chat/stream';

    async *streamQuery(userMessage: string): AsyncGenerator<SSEEvent> {
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage })
        })

        if (!response.body) {
            throw new Error('Readable stream not supported.')
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) { break }

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data:')) {
                    const jsonStr = trimmed.replace(/^data:\s*/, '');
                    if (jsonStr) {
                        try {
                            const event: SSEEvent = JSON.parse(jsonStr);
                            yield event; // Yields event live to the component!
                        } catch (err) {
                            console.warn('Unable to parse SSE chunk:', jsonStr);
                        }
                    }
                }
            }
        }
    }
}