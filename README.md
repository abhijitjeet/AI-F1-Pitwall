# 🏎️ F1 Pit Wall AI App

An intelligent, full-stack Formula 1 Race Analytics platform. The application features an AI Agent (NestJS + LangChain + LangGraph) capable of translating natural language queries about F1 statistics into read-only SQL, executing them against a SQLite database, and streaming results (token-by-token) along with live reasoning/tool execution logs back to an Angular frontend.

---

## 🏗️ Architecture & Concepts Covered

This project demonstrates several advanced patterns in Full-Stack Development and AI Engineering:

### 1. The Database AI Agent Pattern (ReAct)
Rather than using basic text-to-SQL prompting, the backend uses a stateful **ReAct (Reasoning + Action)** agent built with **LangGraph** (`@langchain/langgraph`) and powered by **GPT-4o-mini**.
* **Dynamic Schema Discovery**: The agent uses a tool (`get_db_schema`) to read table definitions from `sqlite_master` at runtime, ensuring it is always aware of the exact table structures, columns, and relations.
* **Self-Correction & Feedback Loop**: When the agent writes a SQL query, it executes it through `execute_sql_query`. If the database returns a syntax error, the error output is fed back into the agent's context. The agent automatically analyzes the SQL error, corrects its query, and retries—all before returning the final answer to the user.

### 2. SQL Guardrails & Security
To prevent SQL injection or malicious state changes, the SQL execution tool runs against a SQLite connection opened in **readonly** mode. Additionally, the tool includes a regex-based **security guardrail** that blocks any query containing mutation keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`).

### 3. Server-Sent Events (SSE) Streaming
To deliver a smooth UX, the backend controller uses the NestJS `@Sse()` decorator to establish a unidirectional stream. 
* **Tool-Use Statuses**: Before running queries, the backend streams custom status messages (e.g., `🔧 Executing database action: execute_sql_query...`) to show the user exactly what the AI is thinking.
* **Token Streaming**: The AI's response is streamed token-by-token as it's generated, minimizing perceived latency.

### 4. Fast SQLite Ingestion (WAL & Transactions)
The seed engine (`seed.ts`) parses F1 historical CSVs and builds the database. It leverages:
* **Write-Ahead Logging (WAL)**: Enabled via `db.pragma('journal_mode = WAL')` to dramatically speed up SQLite disk writes.
* **Batched Transactions**: Inserts are wrapped in SQLite transactions to ingest tens of thousands of rows of drivers, circuits, races, results, and pit stop times in fractions of a second.

---

## 📂 Project Structure

```
├── Backend/                 # NestJS AI Agent Server
│   ├── data/                # Raw F1 historical CSVs
│   ├── src/
│   │   ├── tools/           # LangChain Database tools (Schema, Read-only SQL runner)
│   │   ├── agent.service.ts # LangGraph Agent setup & stream logic
│   │   ├── chat.controller.ts # SSE controller endpoint
│   │   └── main.ts          # NestJS bootstrapper (CORS enabled)
│   ├── seed.ts              # SQLite database creation & ingestion script
│   └── package.json
│
├── Frontend/
│   └── f1-pitwall-frontend/ # Angular CLI Application
│       ├── src/app/
│       │   ├── models/      # Typings for chat messages and SSE events
│       │   └── ...          # Chat interface components
│
└── DB/                      # Working database folder (git-ignored)
```

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have the following installed on your system:
* **Node.js** (v20.6.0 or higher is recommended for native `.env` file loading)
* **npm** (Node Package Manager)

---

### 🛠️ Setup & Execution Steps

### 1. Database Ingestion
First, navigate to the `Backend` directory, install its package dependencies, and run the ingestion script to load the raw CSVs into SQLite:
```bash
cd Backend
npm install
npx tsx seed.ts
```
This will build and seed the database file at `Backend/f1_pitwall.db`.

### 2. Configure Environment Variables
Copy the configuration template from the root folder to create your local environment file in the `Backend` directory:
```bash
cp ../.env.example .env
```
Open the newly created `.env` file inside the `Backend` directory and insert your OpenAI API key:
```env
OPENAI_API_KEY=sk-proj-yourActualKeyHere...
```

### 3. Running the Backend Server
Start the NestJS backend server. This will run with the native Node.js env-file loader:
```bash
npm run start:env
```
The backend server runs on **`http://localhost:3000`** and handles CORS requests from the frontend.

### 4. Running the Frontend Server
Open a new terminal window, navigate to the frontend folder, install the client dependencies, and launch the Angular development server:
```bash
cd Frontend/f1-pitwall-frontend
npm install
npm start
```
The application will boot and be accessible at **`http://localhost:4200`**. You can open this address in your browser to chat with the F1 Pit Wall AI Agent.

---

## 📊 Database Schema Details
The SQLite database contains the following tables:
* **`circuits`**: circuit identifier, name, location, country.
* **`drivers`**: code, full name, nationality, and references.
* **`races`**: year, round, circuit connection, date, name.
* **`results`**: finishing position, grid position, points, laps completed.
* **`pit_stops`**: lap times, pit stop number, duration in seconds, and milliseconds.

---

## 💬 Sample Queries to Try
* *"Who won the most races in the 2023 season?"*
* *"What is the average pit stop duration at the Monaco Grand Prix?"*
* *"List the nationalities of all drivers who finished in the top 3 at Silverstone in 2022."*
