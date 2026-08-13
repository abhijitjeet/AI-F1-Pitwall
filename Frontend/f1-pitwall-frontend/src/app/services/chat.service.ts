import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SSEEvent } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/chat/stream';

  /**
   * Sends a message to the NestJS backend and returns an Observable
   * streaming SSE events (token streams, tool-use statuses, or done events).
   */
  sendMessage(message: string): Observable<SSEEvent> {
    return new Observable<SSEEvent>((observer) => {
      const abortController = new AbortController();

      (async () => {
        try {
          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ message }),
            signal: abortController.signal
          });

          if (!response.ok) {
            observer.error(new Error(`Failed to connect to stream: ${response.statusText}`));
            return;
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder('utf-8');

          if (!reader) {
            observer.error(new Error('Response body is not readable'));
            return;
          }

          let buffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Split by line to parse SSE protocol lines
            const lines = buffer.split('\n');
            // Retain any incomplete last line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.substring(5).trim();
                try {
                  const event: SSEEvent = JSON.parse(dataStr);
                  observer.next(event);
                } catch (e) {
                  // Warn and skip if keep-alive comment or malformed data
                  console.warn('Skipped raw or malformed SSE line:', dataStr, e);
                }
              }
            }
          }
          
          observer.complete();
        } catch (error: any) {
          if (error.name === 'AbortError') {
            // Log user abort gracefully
            console.log('Chat stream connection aborted by user.');
          } else {
            observer.error(error);
          }
        }
      })();

      return () => {
        // Abort the fetch connection when the subscriber unsubscribes
        abortController.abort();
      };
    });
  }
}
