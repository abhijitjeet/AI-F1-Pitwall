import { Observable } from 'rxjs'
import { Injectable } from '@nestjs/common'
import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { executeSqlTool, getSchemaTool } from './tools/sql.tools.js'


@Injectable()
export class AgentService {
    private agent: any

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        const model = new ChatOpenAI({
            model: 'gpt-4o-mini',
            apiKey: apiKey,
            temperature: 0
        })

        const systemPrompt = `You are an expert Formula 1 Race Analytics AI Agent (Pit Wall AI).
        Your objective is to answer user queries about F1 history, drivers, pit stops, and race results using the SQLite database.

        REASONING RULES:
        1. Always inspect the database schema using 'get_db_schema' first if you need to confirm table structures or column names.
        2. Formulate precise SQL SELECT queries and execute them using 'execute_sql_query'.
        3. Always format your final answer in clean Markdown.`;

        this.agent = createReactAgent({
            llm: model,
            tools: [getSchemaTool, executeSqlTool],
            prompt: systemPrompt
        })
    }

    streamAgentEvents(userQuery: string): Observable<any> {
        return new Observable((subscriber) => {
            (async () => {
                try {
                    const eventStream = this.agent.streamEvents(
                        { messages: [{ role: 'user', content: userQuery }] },
                        { version: 'v2' }
                    );

                    for await (const event of eventStream) {
                        const eventType = String(event.event);
                        if (eventType === 'on_tool_start') {
                            subscriber.next({
                                type: 'status',
                                data: `🔧 Executing database action: ${event.name}...`
                            })
                        } else if (eventType === 'on_chat_model_stream') {

                            const token = event.data?.chunk?.content;
                            if (typeof token === 'string' && token.length > 0) {
                                subscriber.next({
                                    type: 'token',
                                    data: token
                                })
                            }
                        }
                    }

                    subscriber.next({ type: 'done', data: '[DONE]' })
                    subscriber.complete();
                } catch (err: any) {
                    subscriber.error(err)
                }
            })();
        })
    }
}