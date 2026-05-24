"""
internal_rag.py — Session-scoped ChromaDB retrieval

Filters by session_id so each run only searches its own uploaded documents.
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
    query:      str,
    session_id: str,
    top_k:      int = 5,
) -> list[dict]:
    """
    Semantic search over documents uploaded in this session only.

    Args:
        query:      Natural language question
        session_id: Filters to only this session's chunks
        top_k:      Number of chunks to return

    Returns:
        List of dicts matching SourceDoc schema
    """
    try:
        collection = _client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=EMBEDDING_FN,
        )
    except Exception:
        print(f"    ⚠️  ChromaDB collection not found")
        return []

    total_in_session = collection.count()
    if total_in_session == 0:
        print(f"    ⚠️  ChromaDB collection is empty")
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, collection.count()),
            where={"session_id": session_id},   # ← session-scoped
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        print(f"    ⚠️  ChromaDB query failed: {e}")
        return []

    docs      = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for text, meta, distance in zip(documents, metadatas, distances):
        if not text or not text.strip():
            continue

        similarity = max(0.0, 1.0 - (distance / 2.0))
        filename   = meta.get("filename", "unknown")
        page       = meta.get("page", 1)
        chunk_idx  = meta.get("chunk_idx", 0)

        docs.append({
            "url_or_filename":   f"{filename} (p.{page}, chunk {chunk_idx})",
            "content":           text[:2000],
            "source_type":       "internal_doc",
            "credibility_score": 1.0,
            "recency_score":     0.85,
            "is_internal":       True,
            "published_date":    None,
            "_similarity":       round(similarity, 3),
            "_filename":         filename,
            "_page":             page,
        })

    return docs