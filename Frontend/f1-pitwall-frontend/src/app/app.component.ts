import { Component, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { ChatService } from './services/chat.service';
import { ChatMessage } from './models/chat.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'f1-pitwall-frontend';

  private chatService = inject(ChatService);
  @ViewChild('scroll-container') private scrollContainerRef!: ElementRef;

  userPrompt = signal<string>('');
  messages = signal<ChatMessage[]>([]);
  isGenerating = signal<boolean>(false);

  constructor() {
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }


  async sendMessage() {
    const prompt = this.userPrompt().trim();
    if (!prompt || this.isGenerating()) return;

    //1. Reset inout box and lock generation state
    this.userPrompt.set('')
    this.isGenerating.set(true);

    const userMsgId = Date.now().toString();
    const agentMsgId = (Date.now() + 1).toString();

    this.messages.update((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', content: prompt },
      { id: agentMsgId, sender: 'agent', content: '', status: '🏎️ Pit Wall AI analyzing...', isStreaming: true }
    ]);

    try {
      for await (const event of this.chatService.streamQuery(prompt)) {
        if (event.type === 'status') {
          this.updateAgentMessage(agentMsgId, (msg) => ({
            ...msg,
            status: event.data
          }))
        } else if (event.type === 'token') {
          this.updateAgentMessage(agentMsgId, (msg) => ({
            ...msg,
            content: msg.content + event.data
          }))
        } else if (event.type === 'done') {
          this.updateAgentMessage(agentMsgId, (msg) => ({
            ...msg,
            status: undefined,
            isStreaming: false
          }))
        }
      }
    } catch (error) {
      this.updateAgentMessage(agentMsgId, (msg) => ({
        ...msg,
        status: '❌ Not able to connect to pitwall',
        isStreaming: false
      }))
    } finally {
      this.isGenerating.set(false);
    }
  }



  private updateAgentMessage(id: string, updateFn: (msg: ChatMessage) => ChatMessage) {
    this.messages.update((msgs) => msgs.map((m) => (m.id === id ? updateFn(m) : m)))
  }

  private scrollToBottom() {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollTop =
        this.scrollContainerRef.nativeElement.scrollHeight;
    }
  }
}
