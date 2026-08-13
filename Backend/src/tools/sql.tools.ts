import { DynamicStructuredTool } from "@langchain/core/tools"
import Database from "better-sqlite3"
import { z } from 'zod'

//Open SQLite in readonly mode
const db = new Database('f1_pitwall.db', { readonly: true });

const MUTATION_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i;

export const getSchemaTool = new DynamicStructuredTool({
    name: 'get_db_schema',
    description: 'Use this tool to inspect table structures and column names in the F1 database before writing any SQL query',
    schema: z.object({}),
    func: async () => {
        const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL;")
            .all() as { sql: string }[];

        return tables.map((t) => t.sql).join('\n\n')
    }
});

export const executeSqlTool = new DynamicStructuredTool({
    name: 'execute_sql_query',
    description: 'Executes a read-only SQL SELECT query against F1 database and return the result as JSON',
    schema: z.object({
        query: z.string().describe('The SQL SELECT query to run against the database')
    }),
    func: async ({ query }) => {
        //Guardrail to check against any forbidden keywords
        if (MUTATION_KEYWORDS.test(query)) {
            return JSON.stringify({ error: 'Security violation: Only SELECT queries are allowed.' })
        }

        try {
            //Execute the query and return the rows
            const rows = db.prepare(query).all()
            return JSON.stringify(rows)
        } catch (err: any) {
            //If the LLM writes any invaid query, it passes the error back so it can fix it.
            return JSON.stringify({ error: `SQL Execution Error: ${err.message}` })
        }
    }
})