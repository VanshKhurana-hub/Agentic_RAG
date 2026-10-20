# ```markdown
# Agentic RAG HRMS Platform

An autonomous, secure **6-layer Agentic RAG (Retrieval-Augmented Generation)** conversational AI system built for enterprise HRMS workflows. It leverages a **ReAct (Reason + Act)** agent loop to dynamically route user queries between local vector search (Qdrant) and relational structured queries (PostgreSQL), backed by **Amazon Bedrock Nova Micro**.

---

## Architecture & Tech Stack

| Layer / Component | Technology Used | Role in System |
| :--- | :--- | :--- |
| **API & Routing** | FastAPI (Python venv) | Asynchronous microservice routing chat payloads and handling multipart document uploads[cite: 2]. |
| **Agent Orchestration** | LangGraph / LangChain | Manages stateful agent loops, tool binding, and deterministic decision-making. |
| **LLM Engine** | Amazon Bedrock Nova Micro | High-throughput, ultra-low-cost reasoning engine (`temperature=0.0`)[cite: 1]. |
| **Vector Database** | Qdrant (Local disk storage) | Stores semantic vector embeddings (`BAAI/bge-small-en-v1.5`) for company policy PDFs[cite: 1]. |
| **Relational Database** | PostgreSQL | Handles strict tabular data (leave balances, employee profiles) and conversation logs. |
| **Document Parser** | PyMuPDF (`fitz`) + LangChain | Hybrid text extraction and recursive chunking for raw document ingestion[cite: 2]. |
| **Security & Privacy** | Microsoft Presidio (Prepared) | PII masking layer for sanitizing sensitive inputs/outputs. |
| **Frontend UI** | React (Vite & Tailwind CSS) | Responsive modular sidebar interface with active document toggling and session history. |

---

## Core Features

1. **Agentic Tool Routing:** Automatically evaluates whether a query requires searching company policy handbooks (Vector DB) or fetching personal records (PostgreSQL).
2. **Dynamic RBAC & Status Filtering:** Restricts document retrieval based on user permissions and active knowledge base checkboxes[cite: 1].
3. **Session State Persistence:** Tracks conversation memory across threads with built-in fallback guardrails for empty LLM responses[cite: 1].
4. **Interactive Document Manager:** Upload, inspect, and toggle searchable files directly from the React UI dashboard.

---

## Project Structure

```text
RAG_Project-main/
│
├── main.py                     # FastAPI entry point & API endpoints
├── query_engine.py             # LangGraph state machine & agent workflow
├── requirements.txt            # Python dependencies
├── .env                        # Environment credentials (AWS & DB)
│
├── app/
│   └── services/
│       ├── chat_services.py    # Core chat workflow handler
│       ├── tools.py            # Tool definitions (Qdrant & PostgreSQL)
│       └── presidio_helper.py  # PII masking/unmasking hooks
│
└── RAG-frontend/              # React (Vite/Tailwind) Frontend UI
    ├── src/
    │   └── components/
    │       └── SimpleChat.jsx
    └── package.json

```

---

## Getting Started Locally

### 1. Backend Setup

Activate your Python virtual environment and install dependencies:

```powershell
# Navigate to project root
cd RAG_Project-main

# Activate virtual environment
..\.venv\Scripts\Activate.ps1

# Install required packages
pip install -r requirements.txt

```

### 2. Configure Environment Variables

Create a `.env` file in the root directory and configure your credentials:

```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
DB_NAME=AGEtic_RAG
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

```

### 3. Run the FastAPI Backend

```powershell
uvicorn main:app --reload

```

Access the auto-generated Swagger UI docs at: `http://127.0.0.1:8000/docs`

### 4. Run the React Frontend

```powershell
cd RAG-frontend
npm install
npm run dev

```

Open your browser and navigate to the local Vite development URL (typically `http://localhost:5173`).

```

```
