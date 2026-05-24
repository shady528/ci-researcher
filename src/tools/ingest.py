"""
ingest.py — Session-scoped file ingestion into ChromaDB

Every chunk is tagged with a session_id in metadata.
This allows RAG to filter to exactly the current session's documents,
and allows clean deletion when the session resets.
"""

import hashlib
import os
import tempfile
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

CHROMA_PATH     = os.getenv("CHROMA_PATH", ".chroma")
COLLECTION_NAME = "internal_docs"
CHUNK_SIZE      = int(os.getenv("CHUNK_SIZE", 800))
CHUNK_OVERLAP   = int(os.getenv("CHUNK_OVERLAP", 100))

_client = chromadb.PersistentClient(path=CHROMA_PATH)
EMBEDDING_FN = OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small",
)


def _get_or_create_collection():
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=EMBEDDING_FN,
    )


def _extract_text(file_path: str, filename: str) -> list[dict]:
    """Extract text pages from PDF, DOCX, or TXT."""
    ext   = Path(filename).suffix.lower()
    pages = []

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            pages.append({"page": 1, "text": f.read()})

    elif ext == ".pdf":
        try:
            import fitz
            doc = fitz.open(file_path)
            for i, page in enumerate(doc, 1):
                text = page.get_text().strip()
                if text:
                    pages.append({"page": i, "text": text})
        except ImportError:
            raise RuntimeError("PyMuPDF not installed — run: pip install pymupdf")

    elif ext in (".docx", ".doc"):
        try:
            from docx import Document
            doc  = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            pages.append({"page": 1, "text": text})
        except ImportError:
            raise RuntimeError("python-docx not installed — run: pip install python-docx")

    elif ext in (".xlsx", ".xls", ".csv"):
        try:
            import pandas as pd
            if ext == ".csv":
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            text = df.to_string(index=False)
            pages.append({"page": 1, "text": text})
        except ImportError:
            raise RuntimeError("pandas not installed — run: pip install pandas openpyxl")

    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return pages


def _chunk_text(text: str) -> list[str]:
    chunks = []
    start  = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end].strip())
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if len(c) > 50]


def ingest_file(file_path: str, filename: str, session_id: str) -> dict:
    """
    Ingest a file into ChromaDB tagged with session_id.

    All chunks for a session share the same session_id, making it
    trivial to filter during RAG and delete on session reset.

    Returns:
        {"session_id": str, "filename": str, "chunks": int, "pages": int}
    """
    collection = _get_or_create_collection()

    # Generate a stable chunk ID prefix from session + filename
    file_hash  = hashlib.md5(f"{session_id}:{filename}".encode()).hexdigest()[:8]
    chunk_prefix = f"{session_id[:8]}_{file_hash}"

    # Remove any existing chunks for this exact file in this session
    try:
        existing = collection.get(
            where={"$and": [{"session_id": session_id}, {"filename": filename}]}
        )
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
            print(f"[INGEST] Removed {len(existing['ids'])} existing chunks for {filename}")
    except Exception:
        pass

    pages      = _extract_text(file_path, filename)
    all_chunks = []

    for page_data in pages:
        for idx, chunk in enumerate(_chunk_text(page_data["text"])):
            all_chunks.append({
                "text":      chunk,
                "page":      page_data["page"],
                "chunk_idx": idx,
            })

    if not all_chunks:
        raise ValueError(f"No text could be extracted from {filename}")

    # Batch insert
    BATCH = 100
    total = 0
    for i in range(0, len(all_chunks), BATCH):
        batch = all_chunks[i:i + BATCH]
        collection.add(
            documents=[c["text"] for c in batch],
            metadatas=[{
                "session_id": session_id,        # ← key field for filtering + deletion
                "filename":   filename,
                "page":       c["page"],
                "chunk_idx":  c["chunk_idx"],
            } for c in batch],
            ids=[f"{chunk_prefix}_p{c['page']}_c{c['chunk_idx']}" for c in batch],
        )
        total += len(batch)

    print(f"[INGEST] ✅ {filename} → {total} chunks | session: {session_id[:8]}…")

    return {
        "session_id": session_id,
        "filename":   filename,
        "chunks":     total,
        "pages":      len(pages),
    }


def delete_session(session_id: str) -> int:
    """
    Delete all ChromaDB chunks belonging to a session.
    Called when the user resets the UI.
    Returns number of chunks deleted.
    """
    try:
        collection = _get_or_create_collection()
        existing   = collection.get(where={"session_id": session_id})
        count      = len(existing["ids"])
        if count > 0:
            collection.delete(ids=existing["ids"])
            print(f"[INGEST] 🗑  Deleted {count} chunks for session {session_id[:8]}…")
        else:
            print(f"[INGEST] Session {session_id[:8]}… had no chunks to delete")
        return count
    except Exception as e:
        print(f"[INGEST] ⚠️  Cleanup failed: {e}")
        return 0