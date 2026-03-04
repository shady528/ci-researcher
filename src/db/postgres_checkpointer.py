"""
db/postgres_checkpointer.py

LangGraph 1.x correct pattern:
Create a psycopg connection directly and pass it to PostgresSaver.
Do NOT use from_conn_string() — it's a context manager that closes
the connection as soon as the with-block exits.
"""

import os
import psycopg
from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver

load_dotenv()

DB_URI = os.getenv(
    "POSTGRES_URL",
    "postgresql://ci_user:ci_pass_dev@localhost:5432/ci_researcher"
)

_checkpointer = None


def get_checkpointer() -> PostgresSaver:
    """
    Returns a configured PostgresSaver with a persistent connection.
    Creates LangGraph checkpoint tables on first call (idempotent).
    """
    global _checkpointer
    if _checkpointer is None:
        # Open a persistent synchronous psycopg connection
        conn         = psycopg.connect(DB_URI, autocommit=True)
        _checkpointer = PostgresSaver(conn)
        _checkpointer.setup()   # creates checkpoints table if not exists
        print("[DB] ✅ PostgresSaver connected and tables ready")
    return _checkpointer