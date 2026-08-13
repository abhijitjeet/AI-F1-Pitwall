export interface ChatMessage {
    id: string;
    sender: 'user' | 'agent';
    content: string;
    status?: string; // e.g. "🔧 Executing database action: execute_sql_query..."
    isStreaming?: boolean;
}

export interface SSEEvent {
    type: 'status' | 'token' | 'done';
    data: string;
}