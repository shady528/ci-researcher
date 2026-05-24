"""
planner.py — Mode-aware Research Planner with Human-in-the-Loop

Modes:
  web      → 5 web search queries only
  internal → 3 RAG queries only, phrased for semantic document retrieval
  hybrid   → 5 web queries + 2 RAG queries

Rules:
  - file_ids are NEVER passed to the LLM — they are metadata filters only
  - RAG queries must be natural language, never referencing file names or IDs
  - interrupt() pauses the graph for human approval before any searches run
"""

import os
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import interrupt
from src.state import AgentState

# ── System prompts ────────────────────────────────────────────────

SYSTEM_WEB = """You are a research planning expert for a competitive intelligence system.

Your job is to generate highly targeted WEB SEARCH queries for a given topic.

Rules:
- Generate exactly 5 web search queries
- Each query must target a DIFFERENT angle: pricing, features, reviews, news, comparisons
- Queries must be specific and include year or context where relevant
- Output ONLY valid JSON, no explanation, no markdown

Schema:
{
  "queries": ["query1", "query2", "query3", "query4", "query5"],
  "rag_queries": []
}"""

SYSTEM_INTERNAL = """You are a document research expert for an enterprise intelligence system.

Your job is to generate semantic search queries that will be run against internal documents stored in a vector database.

Rules:
- Generate exactly 3 queries
- Queries must be natural language questions or phrases that semantically match content in policy documents, reports, contracts, or manuals
- Queries must be about the TOPIC ONLY — never mention file names, file IDs, document IDs, or any identifiers
- Write queries as if asking a knowledgeable colleague who has read all the documents
- Output ONLY valid JSON, no explanation, no markdown

Schema:
{
  "queries": [],
  "rag_queries": ["question1", "question2", "question3"]
}"""

SYSTEM_HYBRID = """You are a research planning expert for a competitive intelligence system.

Your job is to generate both WEB SEARCH queries and DOCUMENT RETRIEVAL queries for a given topic.

Rules:
- Generate exactly 5 web search queries targeting different angles: pricing, features, reviews, news, comparisons
- Generate exactly 2 RAG queries as natural language questions that would match content in internal policy or business documents
- RAG queries must be about the TOPIC ONLY — never mention file names, file IDs, or document identifiers
- Web queries should target external sources with year and context
- Output ONLY valid JSON, no explanation, no markdown

Schema:
{
  "queries": ["web1", "web2", "web3", "web4", "web5"],
  "rag_queries": ["rag1", "rag2"]
}"""

# ── Human messages ────────────────────────────────────────────────
# file_ids are intentionally excluded — they are ChromaDB metadata
# filters used by the researcher, not LLM context

HUMAN_WEB = """Research topic: {topic}

Generate the web search plan now."""

HUMAN_INTERNAL = """Research topic: {topic}

Generate natural language semantic search queries to find relevant information about this topic in internal documents.
Write questions a researcher would ask — do NOT reference any file names, IDs, or document identifiers.

Generate the RAG query plan now."""

HUMAN_HYBRID = """Research topic: {topic}

Generate both web search queries and RAG document retrieval queries for this topic.
RAG queries must be natural language questions only — do NOT reference any file names, IDs, or document identifiers.

Generate the search plan now."""


def make_planner_node(llm):
    def planner_node(state: AgentState) -> dict:
        source_mode = state["source_mode"]
        topic       = state["topic"]

        print(f"\n[PLANNER] 📋 Topic: {topic}")
        print(f"  Source mode : {source_mode}")

        system_map = {
            "web":      SYSTEM_WEB,
            "internal": SYSTEM_INTERNAL,
            "hybrid":   SYSTEM_HYBRID,
        }
        human_map = {
            "web":      HUMAN_WEB.format(topic=topic),
            "internal": HUMAN_INTERNAL.format(topic=topic),
            "hybrid":   HUMAN_HYBRID.format(topic=topic),
        }

        messages = [
            SystemMessage(content=system_map.get(source_mode, SYSTEM_WEB)),
            HumanMessage(content=human_map.get(source_mode, HUMAN_WEB.format(topic=topic))),
        ]

        response = llm.invoke(messages)
        raw      = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw.strip())

        proposed_queries     = parsed.get("queries",     [])
        proposed_rag_queries = parsed.get("rag_queries", [])

        if source_mode in ("web", "hybrid") and proposed_queries:
            print(f"\n  Proposed web queries ({len(proposed_queries)}):")
            for i, q in enumerate(proposed_queries, 1):
                print(f"    {i}. {q}")

        if source_mode in ("internal", "hybrid") and proposed_rag_queries:
            print(f"\n  Proposed RAG queries ({len(proposed_rag_queries)}):")
            for i, q in enumerate(proposed_rag_queries, 1):
                print(f"    {i}. {q}")

        human_input = interrupt({
            "message":     "Review and approve the proposed search queries",
            "queries":     proposed_queries,
            "rag_queries": proposed_rag_queries,
            "topic":       topic,
            "source_mode": source_mode,
        })

        if isinstance(human_input, dict):
            final_queries     = human_input.get("queries",     proposed_queries)
            final_rag_queries = human_input.get("rag_queries", proposed_rag_queries)
        else:
            final_queries     = proposed_queries
            final_rag_queries = proposed_rag_queries

        if source_mode in ("web", "hybrid"):
            print(f"\n  ✅ {len(final_queries)} web queries approved.")
        if source_mode in ("internal", "hybrid"):
            print(f"  ✅ {len(final_rag_queries)} RAG queries approved.")

        return {
            "queries":         final_queries,
            "rag_queries":     final_rag_queries,
            "iteration_count": 0,
            "max_iterations":  int(os.getenv("MAX_ITERATIONS", 3)),
        }

    return planner_node