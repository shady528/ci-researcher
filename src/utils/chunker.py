"""
chunker.py — Document ingestion pipeline

Flow:
  uploaded file → parse text → split into chunks
  → embed with OpenAI → store in ChromaDB with metadata

Supports: PDF (.pdf), Word (.docx), plain text (.txt)
"""

import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

load_dotenv()

# ── ChromaDB client — persists to .chroma/ directory ─────────────
CHROMA_PATH = os.getenv("CHROMA_PATH", ".chroma")
_client = chromadb.PersistentClient(path=CHROMA_PATH)

EMBEDDING_FN = OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small",   # 1536-dim, best price/perf
)

# One collection for all internal documents
COLLECTION_NAME = "internal_docs"

def get_collection():
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=EMBEDDING_FN,
        metadata={"hnsw:space": "cosine"},  # cosine similarity for retrieval
    )


# ── Text extraction ───────────────────────────────────────────────

def _extract_pdf(path: str) -> list[dict]:
    """Extract text from PDF, one entry per page."""
    import fitz  # PyMuPDF
    doc = fitz.open(path)
    pages = []
    for page_num, page in enumerate(doc, 1):
        text = page.get_text().strip()
        if text:
            pages.append({"text": text, "page": page_num})
    doc.close()
    return pages


def _extract_docx(path: str) -> list[dict]:
    """Extract text from DOCX, grouped into ~page-sized chunks."""
    from docx import Document
    doc = Document(path)
    # Group paragraphs into pseudo-pages of ~500 words each
    pages, current, word_count = [], [], 0
    page_num = 1
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        current.append(text)
        word_count += len(text.split())
        if word_count >= 500:
            pages.append({"text": "\n".join(current), "page": page_num})
            current, word_count = [], 0
            page_num += 1
    if current:
        pages.append({"text": "\n".join(current), "page": page_num})
    return pages


def _extract_txt(path: str) -> list[dict]:
    """Extract plain text, split into ~500-word blocks."""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        words = f.read().split()
    pages, chunk_size = [], 500
    for i, start in enumerate(range(0, len(words), chunk_size), 1):
        chunk = " ".join(words[start:start + chunk_size])
        pages.append({"text": chunk, "page": i})
    return pages


def _extract_text(path: str) -> list[dict]:
    """Route to the right extractor based on file extension."""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(path)
    elif ext == ".docx":
        return _extract_docx(path)
    elif ext == ".txt":
        return _extract_txt(path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Use .pdf, .docx, or .txt")


# ── Chunking ──────────────────────────────────────────────────────

def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping word-based chunks.
    chunk_size: target words per chunk
    overlap: words to repeat between chunks for context continuity
    """
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap  # step back by overlap
    return chunks


# ── Ingestion ─────────────────────────────────────────────────────

def ingest_document(file_path: str) -> dict:
    """
    Full pipeline: parse → chunk → embed → store in ChromaDB.

    Returns a summary dict with file_id and chunk_count.
    """
    path     = Path(file_path)
    filename = path.name
    file_id  = str(uuid.uuid4())

    print(f"\n[CHUNKER] 📄 Ingesting: {filename}")

    # 1. Extract text by page
    pages = _extract_text(file_path)
    print(f"  Extracted {len(pages)} page(s)")

    # 2. Chunk each page's text
    all_chunks: list[str]    = []
    all_ids:    list[str]    = []
    all_meta:   list[dict]   = []

    for page_data in pages:
        page_chunks = _chunk_text(page_data["text"])
        for chunk_idx, chunk in enumerate(page_chunks):
            chunk_id = f"{file_id}_p{page_data['page']}_c{chunk_idx}"
            all_chunks.append(chunk)
            all_ids.append(chunk_id)
            all_meta.append({
                "file_id":    file_id,
                "filename":   filename,
                "page":       page_data["page"],
                "chunk_idx":  chunk_idx,
                "file_path":  str(path.absolute()),
            })

    print(f"  Split into {len(all_chunks)} chunks "
          f"(~500 words each, 50-word overlap)")

    # 3. Store in ChromaDB — embeddings generated automatically
    collection = get_collection()
    
    # Add in batches of 100 to avoid API rate limits
    batch_size = 100
    for i in range(0, len(all_chunks), batch_size):
        collection.add(
            documents=all_ids[i:i + batch_size],
            # ChromaDB uses the embedding function on the documents
            # We want to embed the actual text, not the IDs
            # So we pass text as documents and IDs separately
            ids=all_ids[i:i + batch_size],
            metadatas=all_meta[i:i + batch_size],
        )
        # Override: store actual text content alongside
        # ChromaDB add() embeds `documents` — we need text embedded, not IDs
        # Correct approach: pass text as documents param
    
    # Re-add correctly with text as documents
    # First delete what we just added
    collection.delete(ids=all_ids)
    
    for i in range(0, len(all_chunks), batch_size):
        batch_docs = all_chunks[i:i + batch_size]
        batch_ids  = all_ids[i:i + batch_size]
        batch_meta = all_meta[i:i + batch_size]
        collection.add(
            documents=batch_docs,   # ← text gets embedded
            ids=batch_ids,
            metadatas=batch_meta,
        )
        print(f"  Embedded batch {i // batch_size + 1} "
              f"({len(batch_docs)} chunks)…")

    print(f"  ✅ {filename} → {len(all_chunks)} chunks stored in ChromaDB")
    print(f"  File ID: {file_id}")

    return {
        "file_id":     file_id,
        "filename":    filename,
        "chunk_count": len(all_chunks),
        "page_count":  len(pages),
    }


def list_ingested_files() -> list[dict]:
    """Return a summary of all files currently in ChromaDB."""
    collection = get_collection()
    results    = collection.get(include=["metadatas"])
    
    # Deduplicate by file_id
    seen, files = set(), []
    for meta in results["metadatas"]:
        fid = meta.get("file_id")
        if fid and fid not in seen:
            seen.add(fid)
            files.append({
                "file_id":  fid,
                "filename": meta.get("filename"),
            })
    return files


def delete_file(file_id: str) -> int:
    """Remove all chunks for a given file_id from ChromaDB."""
    collection = get_collection()
    results    = collection.get(
        where={"file_id": file_id},
        include=["metadatas"],
    )
    ids_to_delete = results["ids"]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    return len(ids_to_delete)