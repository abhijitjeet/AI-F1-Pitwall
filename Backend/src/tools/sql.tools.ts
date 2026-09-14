import { DynamicStructuredTool } from "@langchain/core/tools"
import Database from "better-sqlite3"
import { z } from 'zod'
import { SqlAstValidator } from "./sql-validator.util.js";

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

// export const executeSqlTool = new DynamicStructuredTool({
//     name: 'execute_sql_query',
//     description: 'Executes a read-only SQL SELECT query against F1 database and return the result as JSON',
//     schema: z.object({
//         query: z.string().describe('The SQL SELECT query to run against the database')
//     }),
//     func: async ({ query }) => {
//         //Guardrail to check against any forbidden keywords
//         if (MUTATION_KEYWORDS.test(query)) {
//             return JSON.stringify({ error: 'Security violation: Only SELECT queries are allowed.' })
//         }

//         try {
//             //Execute the query and return the rows
//             const rows = db.prepare(query).all()
//             return JSON.stringify(rows)
//         } catch (err: any) {
//             //If the LLM writes any invaid query, it passes the error back so it can fix it.
//             return JSON.stringify({ error: `SQL Execution Error: ${err.message}` })
//         }
//     }
// });

export const executeSqlTool = new DynamicStructuredTool({
    name: 'execute_sql_query',
    description: 'Executes a read-only SQL SELECT query against F1 database and return the result as JSON',
    schema: z.object({
        query: z.string().describe('The SQL SELECT query to run against the database')
    }),
    func: async ({ query }) => {

        // 1. Run the query through the SQL AST validator to ensure it is a single SELECT statement and sanitize it.
        const validation = SqlAstValidator.validate(query);
        if(!validation.isValid) {
            // If the query is invalid, return a structured error response so that the LLM can read the failure and self-correct
            return JSON.stringify({
                status: 'error',
                code: 'GUARDRAIL_BLOCKED',
                reason: validation.error,
                suggestion: 'Ensure your query is single SELECT statement'
            })
        }

        // 2. Execute sanitized query safely against the database and return results as JSON. Limit to 50 rows to avoid overwhelming the LLM.
        try {
            const stmt = db.prepare(validation.sanitizesSql!);
            const rows = stmt.all();

            // Hard cap at 50 rows to avoid overwhelming the LLM with too much data.
            const cappedRows = rows.slice(0, 50);

            return JSON.stringify({
                status: 'success',
                rowCount: rows.length,
                returnedCount: cappedRows.length,
                data: cappedRows
            })
        } catch (dbError: any) {
            // Database runtime error (eg: invalid column name, etc).
            return JSON.stringify({
                status: 'error',
                code: 'SQL_EXECUTION_ERROR',
                message: dbError.message
            });
        }
    }
})