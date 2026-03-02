import os
import hashlib
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from tavily import TavilyClient
import redis

from src.state import AgentState, SourceDoc

load_dotenv()

# ── Clients ──────────────────────────────────────────────────────
tavily  = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
r       = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", 86400))


# ── Helpers ──────────────────────────────────────────────────────

def _cache_key(query: str) -> str:
    """Deterministic cache key from query string."""
    return "tavily:" + hashlib.sha256(query.encode()).hexdigest()


def _recency_score(date_str: str | None) -> float:
    """
    Score 0.0–1.0 based on how recent the published date is.
    - Published today      → 1.0
    - Published 12mo ago   → ~0.5
    - Published 24mo+ ago  → 0.1
    - No date available    → 0.5 (neutral)
    """
    if not date_str:
        return 0.5
    try:
        pub = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days_old = (now - pub).days
        # Linear decay: 0 days → 1.0, 730 days → 0.1
        score = max(0.1, 1.0 - (days_old / 730) * 0.9)
        return round(score, 2)
    except Exception:
        return 0.5


def _source_type(url: str) -> str:
    """
    Classify source type from URL.
    Validator node will refine this further with LLM scoring.
    """
    url_lower = url.lower()
    official_domains = [
        "hubspot.com", "salesforce.com", "pipedrive.com",
        "monday.com", "sec.gov", "gartner.com", "forrester.com",
        ".gov", ".edu", "techcrunch.com", "bloomberg.com",
    ]
    review_domains = ["g2.com", "capterra.com", "trustradius.com", "getapp.com"]
    reddit_domains  = ["reddit.com", "old.reddit.com"]

    if any(d in url_lower for d in official_domains):
        return "official"
    if any(d in url_lower for d in review_domains):
        return "review_site"
    if any(d in url_lower for d in reddit_domains):
        return "reddit"
    return "blog"


def _search_with_cache(query: str) -> list[dict]:
    """
    Search Tavily with Redis caching.
    Cache hit  → return stored results, zero API cost.
    Cache miss → call Tavily, store results for CACHE_TTL seconds.
    """
    key = _cache_key(query)

    # Check cache first
    try:
        cached = r.get(key)
        if cached:
            print(f"    💾 Cache hit: {query[:50]}…")
            return json.loads(cached)
    except redis.RedisError:
        # Redis unavailable — continue without cache
        pass

    # Cache miss — call Tavily
    print(f"    🌐 Tavily search: {query[:50]}…")
    try:
        response = tavily.search(
            query=query,
            search_depth="advanced",   # advanced = better results, costs 2 credits
            max_results=5,
            include_published_date=True,
        )
        results = response.get("results", [])

        # Cache the results
        try:
            r.setex(key, CACHE_TTL, json.dumps(results))
        except redis.RedisError:
            pass

        return results

    except Exception as e:
        print(f"    ⚠️  Tavily error for '{query}': {e}")
        return []


# ── The Node ─────────────────────────────────────────────────────

def researcher_node(state: AgentState) -> dict:
    iteration = state["iteration_count"]
    queries   = state["queries"]

    # On gap-fill iterations, use the suggested_query from each gap
    # instead of the original queries
    if iteration > 0 and state.get("gaps"):
        gap_queries = [g["suggested_query"] for g in state["gaps"] if not g["resolved"]]
        if gap_queries:
            queries = gap_queries
            print(f"\n[RESEARCHER] 🔍 Gap-fill iteration {iteration} | "
                  f"{len(queries)} targeted queries")
        else:
            print(f"\n[RESEARCHER] 🔍 Iteration {iteration} | "
                  f"No unresolved gaps — using original queries")
    else:
        print(f"\n[RESEARCHER] 🔍 Iteration {iteration} | "
              f"{len(queries)} web queries")

    new_docs: list[SourceDoc] = []

    for query in queries:
        results = _search_with_cache(query)

        for r_item in results:
            url          = r_item.get("url", "")
            content      = r_item.get("content", "")
            published    = r_item.get("published_date")
            source_type  = _source_type(url)
            recency      = _recency_score(published)

            if not content.strip():
                continue  # skip empty results

            doc: SourceDoc = {
                "url_or_filename":  url,
                "content":          content[:2000],  # cap at 2k chars per doc
                "source_type":      source_type,
                "credibility_score": 0.0,    # Validator fills this
                "recency_score":    recency,
                "is_internal":      False,
                "published_date":   published,
            }
            new_docs.append(doc)

    print(f"  → {len(new_docs)} documents collected")

    # Deduplicate by URL — avoid storing the same page twice across iterations
    existing_urls = {d["url_or_filename"] for d in state.get("docs", [])}
    deduped = [d for d in new_docs if d["url_or_filename"] not in existing_urls]

    print(f"  → {len(deduped)} new unique docs after deduplication")

    return {"docs": deduped}