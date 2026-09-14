import NodeSqlParser from 'node-sql-parser';
import type { AST } from 'node-sql-parser';

export interface SqlValidation {
    isValid: boolean;
    sanitizesSql?: string;
    error?: string
}

export class SqlAstValidator {
    private static parser = new NodeSqlParser.Parser();

    /**
     * Validates that the input query is strictly a single, read-only SELECT query for SQLite.
     */
    static validate(rawSql: string): SqlValidation {
        // 1. Basic sanity check & trim trailing semicolons/whitespace
        const trimmedSql = rawSql.trim().replace(/;+$/, '');
        if(!trimmedSql) {
            return {
                isValid: false,
                error: 'SQL Query string cannot be empty.'
            };
        }

        try {
            // 2. Parse into Abstract Syntax Tree using SQLite dialect.
            const astResult: AST | AST[] = this.parser.astify(trimmedSql, {database: 'sqlite'});

            // 3. Reject multi-statement queries (eg: "SELECT 1; DROP TABLE telemetry")
            if(Array.isArray(astResult)) {
                if(astResult.length > 1) {
                    return {
                        isValid: false,
                        error: 'Multiple SQL Statements detected. Only single SELECT query is allowed.'
                    }
                }
            }
            // Extract single AST Node
            const ast: AST = Array.isArray(astResult) ? astResult[0] as AST : astResult as AST

            // 4. Enforce just SELECT query.
            if(ast.type !== 'select') {
                return {
                    isValid: false,
                    error: `Disallowed SQL statement type: "${ast.type.toUpperCase()}". Only SELECT queries are allowerd.`
                }
            }

            // 5. Re-stringify the AST back to standard SQL
            const sanitized = this.parser.sqlify(ast, {database: 'sqlite'});
            return {
                isValid: true,
                sanitizesSql: sanitized
            }
        } catch (parseError: any) {
            return {
                isValid: false,
                error: `SQL Syntax Error: Could not parse SQLite syntax. Details: ${parseError.message}`
            }
        }
    }
}