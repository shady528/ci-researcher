"""
internal_rag.py — ChromaDB retrieval tool

Used by the Researcher node when source_mode is "internal" or "hybrid".
Takes a natural language query, returns the most relevant internal doc chunks.
"""

import os
from dotenv import load_dotenv
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

load_dotenv()

CHROMA_PATH     = os.getenv("CHROMA_PATH", ".chroma")
COLLECTION_NAME = "internal_docs"

_client = chromadb.PersistentClient(path=CHROMA_PATH)
EMBEDDING_FN = OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small",
)


def query_internal_docs(
    query: str,
    top_k: int = 5,
    file_ids: list[str] | None = None,
) -> list[dict]:
    """
    Semantic search over ingested internal documents.

    Args:
        query:    Natural language question to search for
        top_k:   Number of chunks to return
        file_ids: Optional — filter to specific uploaded files only

    Returns:
        List of dicts matching SourceDoc schema (without credibility scores,
        those are filled in by the Validator node).
    """
    try:
        collection = _client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=EMBEDDING_FN,
        )
    except Exception:
        print(f"    ⚠️  ChromaDB collection not found — no internal docs ingested yet")
        return []

    # Build where filter if file_ids provided
    where = None
    if file_ids:
        if len(file_ids) == 1:
            where = {"file_id": file_ids[0]}
        else:
            where = {"file_id": {"$in": file_ids}}

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, collection.count()),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        print(f"    ⚠️  ChromaDB query failed: {e}")
        return []

    docs = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for text, meta, distance in zip(documents, metadatas, distances):
        if not text or not text.strip():
            continue

        # Convert cosine distance → similarity score (0–1)
        # ChromaDB cosine distance: 0 = identical, 2 = opposite
        similarity = max(0.0, 1.0 - (distance / 2.0))

        filename   = meta.get("filename", "unknown")
        page       = meta.get("page", 1)
        chunk_idx  = meta.get("chunk_idx", 0)

        docs.append({
            "url_or_filename":  f"{filename} (p.{page}, chunk {chunk_idx})",
            "content":          text[:2000],
            "source_type":      "internal_doc",
            "credibility_score": 1.0,      # internal docs always trusted
            "recency_score":    0.85,       # assume moderately recent
            "is_internal":      True,
            "published_date":   None,
            # Extra metadata for audit trail
            "_similarity":      round(similarity, 3),
            "_filename":        filename,
            "_page":            page,
        })

    return docs