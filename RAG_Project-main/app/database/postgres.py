# app/database/postgres.py
import os
import psycopg2
from psycopg_pool import ConnectionPool

DB_URI = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/AGEtic_RAG"
)

# Shared connection pool for light operations
def get_db_connection():
    return psycopg2.connect(DB_URI)

def init_db():
    """Initializes schema and required PostgreSQL tables."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                file_hash VARCHAR(64) UNIQUE NOT NULL,
                filename VARCHAR(255) NOT NULL,
                category VARCHAR(100) DEFAULT 'General',
                uploaded_by VARCHAR(100) DEFAULT 'HR_Admin',
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database schema initialized successfully.")
    except Exception as e:
        print(f"⚠️ PostgreSQL initialization error: {e}")