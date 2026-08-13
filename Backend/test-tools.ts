import { getSchemaTool, executeSqlTool } from './src/tools/sql.tools.js';

async function testTools() {
    console.log('🔍 Testing Tool 1: get_db_schema...\n');
    const schemaResult = await getSchemaTool.invoke({});
    console.log(schemaResult);

    console.log('\n----------------------------------------\n');

    console.log('🏎️ Testing Tool 2: execute_sql_query...\n');
    const queryResult = await executeSqlTool.invoke({
        query: 'SELECT full_name, nationality FROM drivers LIMIT 3;',
    });
    console.log(queryResult);
}

testTools().catch((err) => console.error('Tool test failed:', err));