"""
nodes/planner.py — with Human-in-the-Loop interrupt()

Flow:
  1. GPT-4o generates queries
  2. interrupt() pauses the graph and surfaces queries to the caller
  3. Caller can approve as-is OR pass back edited queries
  4. Graph resumes from this exact point — no re-planning needed

The interrupt value is whatever you pass to graph.invoke() or
graph.resume() as the second argument after the pause.
"""

import os
import json
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import interrupt          # ← LangGraph 1.x
from src.state import AgentState

load_dotenv()

planner_llm = init_chat_model(
    model="gpt-4o",
    model_provider="openai",
    temperature=0.2,
    api_key=os.getenv("OPENAI_API_KEY"),
)

PLANNER_SYSTEM = """You are a research planning expert for a competitive intelligence system.

Your ONLY job is to break a research topic into highly targeted search queries.

Rules:
- Generate exactly 5 web search queries
- Each query must target a DIFFERENT angle: pricing, features, reviews, news, comparisons
- Queries must be specific enough to return useful results (include year, context)
- If source_mode is "hybrid" or "internal", also generate 2 RAG queries for internal documents
- RAG queries should be phrased as questions that would match clauses in policy/audit documents

Output ONLY valid JSON. No explanation, no markdown, no preamble.

Schema:
{
  "queries": ["query1", "query2", "query3", "query4", "query5"],
  "rag_queries": []
}"""

PLANNER_HUMAN = """Research topic: {topic}
Source mode: {source_mode}
Uploaded internal documents: {uploaded_files}

Generate the search plan now."""


def planner_node(state: AgentState) -> dict:
    print(f"\n[PLANNER] 📋 Topic: {state['topic']}")
    print(f"  Source mode : {state['source_mode']}")

    # ── Step 1: Generate queries with GPT-4o ─────────────────────
    messages = [
        SystemMessage(content=PLANNER_SYSTEM),
        HumanMessage(content=PLANNER_HUMAN.format(
            topic=state["topic"],
            source_mode=state["source_mode"],
            uploaded_files=state["uploaded_file_ids"] or "None",
        ))
    ]

    response = planner_llm.invoke(messages)
    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    parsed = json.loads(raw.strip())

    proposed_queries     = parsed.get("queries", [])
    proposed_rag_queries = parsed.get("rag_queries", [])

    print(f"\n  Proposed web queries ({len(proposed_queries)}):")
    for i, q in enumerate(proposed_queries, 1):
        print(f"    {i}. {q}")
    if proposed_rag_queries:
        print(f"  Proposed RAG queries ({len(proposed_rag_queries)}):")
        for i, q in enumerate(proposed_rag_queries, 1):
            print(f"    {i}. {q}")

    # ── Step 2: interrupt() — pause for human approval ───────────
    # The graph is now PAUSED. Execution resumes only when the caller
    # calls app.invoke(Command(resume=...)) with the approved queries.
    #
    # interrupt() returns whatever value the human sends back.
    # If they approve as-is, we send back the original queries.
    # If they edit, we use their version.
    #
    # interrupt() value surfaced to the caller:
    human_input = interrupt({
        "message":       "Review and approve the proposed search queries",
        "queries":       proposed_queries,
        "rag_queries":   proposed_rag_queries,
        "topic":         state["topic"],
        "instructions":  (
            "Call app.invoke(Command(resume=approved_queries), config) to continue.\n"
            "approved_queries = {'queries': [...], 'rag_queries': [...]}"
        ),
    })

    # ── Step 3: Resume with approved/edited queries ───────────────
    # human_input is whatever was passed to Command(resume=...)
    if isinstance(human_input, dict):
        final_queries     = human_input.get("queries",     proposed_queries)
        final_rag_queries = human_input.get("rag_queries", proposed_rag_queries)
    else:
        # Human passed None or just approved — use originals
        final_queries     = proposed_queries
        final_rag_queries = proposed_rag_queries

    print(f"\n  ✅ Queries approved. Running {len(final_queries)} web + "
          f"{len(final_rag_queries)} RAG queries.")

    return {
        "queries":         final_queries,
        "rag_queries":     final_rag_queries,
        "iteration_count": 0,
        "max_iterations":  int(os.getenv("MAX_ITERATIONS", 3)),
    }