import os
import json
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState

load_dotenv()

# ── Model init ───────────────────────────────────────────────────
# init_chat_model is the LangChain 1.x preferred pattern.
# Swap provider string to switch between OpenAI / Anthropic / etc.
planner_llm = init_chat_model(
    model="gpt-4o",
    model_provider="openai",
    temperature=0.2,       # low temp = consistent structured output
    api_key=os.getenv("OPENAI_API_KEY"),
)

# ── Prompt ───────────────────────────────────────────────────────
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

    # Build the prompt
    messages = [
        SystemMessage(content=PLANNER_SYSTEM),
        HumanMessage(content=PLANNER_HUMAN.format(
            topic=state["topic"],
            source_mode=state["source_mode"],
            uploaded_files=state["uploaded_file_ids"] or "None",
        ))
    ]

    # Call GPT-4o
    response = planner_llm.invoke(messages)
    raw = response.content.strip()

    # Parse JSON response
    # Strip markdown code fences if model wraps in them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    parsed = json.loads(raw.strip())

    queries     = parsed.get("queries", [])
    rag_queries = parsed.get("rag_queries", [])

    print(f"  Web queries ({len(queries)}):")
    for q in queries:
        print(f"    → {q}")
    if rag_queries:
        print(f"  RAG queries ({len(rag_queries)}):")
        for q in rag_queries:
            print(f"    → {q}")

    return {
        "queries":         queries,
        "rag_queries":     rag_queries,
        "iteration_count": 0,
        "max_iterations":  int(os.getenv("MAX_ITERATIONS", 3)),
    }