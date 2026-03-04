"""
researcher.py — Hybrid Researcher Node (Web + Internal RAG)

Routing logic:
  source_mode = "web"      → Tavily only
  source_mode = "internal" → ChromaDB only
  source_mode = "hybrid"   → both, results merged
"""

import os
import hashlib
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from tavily import TavilyClient
import redis

from src.state import AgentState, SourceDoc
from src.tools.internal_rag import query_internal_docs

load_dotenv()

# ── Clients ──────────────────────────────────────────────────────
tavily    = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", 86400))


# ── Helpers (unchanged from previous version) ─────────────────────

def _cache_key(query: str) -> str:
    return "tavily:" + hashlib.sha256(query.encode()).hexdigest()


def _recency_score(date_str: str | None) -> float:
    if not date_str:
        return 0.5
    try:
        pub      = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now      = datetime.now(timezone.utc)
        days_old = (now - pub).days
        return round(max(0.1, 1.0 - (days_old / 730) * 0.9), 2)
    except Exception:
        return 0.5


def _source_type(url: str) -> str:
    url_lower = url.lower()
    official  = ["hubspot.com", "salesforce.com", "pipedrive.com", "monday.com",
                 "sec.gov", "gartner.com", "forrester.com", ".gov", ".edu",
                 "techcrunch.com", "bloomberg.com", "samsung.com", "apple.com"]
    reviews   = ["g2.com", "capterra.com", "trustradius.com", "getapp.com"]
    reddit    = ["reddit.com", "old.reddit.com"]
    if any(d in url_lower for d in official): return "official"
    if any(d in url_lower for d in reviews):  return "review_site"
    if any(d in url_lower for d in reddit):   return "reddit"
    return "blog"


def _web_search(query: str) -> list[SourceDoc]:
    """Tavily search with Redis caching."""
    key = _cache_key(query)
    try:
        cached = redis_client.get(key)
        if cached:
            print(f"    💾 Cache hit : {query[:55]}…")
            raw_results = json.loads(cached)
        else:
            print(f"    🌐 Web search: {query[:55]}…")
            resp        = tavily.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                include_published_date=True,
            )
            raw_results = resp.get("results", [])
            try:
                redis_client.setex(key, CACHE_TTL, json.dumps(raw_results))
            except redis.RedisError:
                pass
    except redis.RedisError:
        print(f"    🌐 Web search (no cache): {query[:55]}…")
        raw_results = tavily.search(
            query=query, search_depth="advanced",
            max_results=5, include_published_date=True,
        ).get("results", [])
    except Exception as e:
        print(f"    ⚠️  Search error for '{query}': {e}")
        return []

    docs = []
    for r in raw_results:
        content = r.get("content", "")
        if not content.strip():
            continue
        url = r.get("url", "")
        docs.append({
            "url_or_filename":  url,
            "content":          content[:2000],
            "source_type":      _source_type(url),
            "credibility_score": 0.0,
            "recency_score":    _recency_score(r.get("published_date")),
            "is_internal":      False,
            "published_date":   r.get("published_date"),
        })
    return docs


def _rag_search(query: str, file_ids: list[str]) -> list[SourceDoc]:
    """ChromaDB semantic search over internal documents."""
    print(f"    📁 RAG search: {query[:55]}…")
    results = query_internal_docs(query, top_k=5, file_ids=file_ids or None)
    if results:
        print(f"       → {len(results)} internal chunks found")
    else:
        print(f"       → No internal chunks matched")
    return results


# ── The Node ─────────────────────────────────────────────────────

def researcher_node(state: AgentState) -> dict:
    source_mode  = state.get("source_mode", "web")
    iteration    = state["iteration_count"]
    file_ids     = state.get("uploaded_file_ids", [])

    # On gap-fill iterations, use gap queries instead of original
    if iteration > 0 and state.get("gaps"):
        unresolved = [g for g in state["gaps"] if not g["resolved"]]
        if unresolved:
            web_queries = [g["suggested_query"] for g in unresolved]
            rag_queries = state.get("rag_queries", [])
            print(f"\n[RESEARCHER] 🔍 Gap-fill iteration {iteration} | "
                  f"{len(web_queries)} targeted queries")
        else:
            web_queries = state["queries"]
            rag_queries = state.get("rag_queries", [])
            print(f"\n[RESEARCHER] 🔍 Iteration {iteration} | "
                  f"No unresolved gaps")
    else:
        web_queries = state["queries"]
        rag_queries = state.get("rag_queries", [])
        mode_label  = {
            "web":      "🌐 Web only",
            "internal": "📁 Internal RAG only",
            "hybrid":   "⚡ Hybrid (Web + RAG)",
        }.get(source_mode, source_mode)
        print(f"\n[RESEARCHER] 🔍 Iteration {iteration} | "
              f"{mode_label} | {len(web_queries)} web + {len(rag_queries)} RAG queries")

    new_docs: list[SourceDoc] = []

    # ── Web search ────────────────────────────────────────────────
    if source_mode in ("web", "hybrid"):
        for query in web_queries:
            new_docs.extend(_web_search(query))

    # ── Internal RAG search ───────────────────────────────────────
    if source_mode in ("internal", "hybrid"):
        if not file_ids:
            print(f"    ⚠️  No files uploaded — skipping RAG search")
        else:
            queries_to_run = rag_queries if rag_queries else web_queries
            for query in queries_to_run:
                new_docs.extend(_rag_search(query, file_ids))

    print(f"  → {len(new_docs)} raw documents collected")

    # Deduplicate by URL/filename
    existing_urls = {d["url_or_filename"] for d in state.get("docs", [])}
    deduped       = [d for d in new_docs
                     if d["url_or_filename"] not in existing_urls]

    # Remove duplicates within this batch too (same URL from 2 queries)
    seen, unique = set(), []
    for d in deduped:
        key = d["url_or_filename"]
        if key not in seen:
            seen.add(key)
            unique.append(d)

    internal_count = sum(1 for d in unique if d["is_internal"])
    web_count      = len(unique) - internal_count

    print(f"  → {len(unique)} new unique docs "
          f"({web_count} web, {internal_count} internal)")

    return {"docs": unique}