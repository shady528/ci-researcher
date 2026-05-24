"""
main.py — Mode-aware Human-in-the-Loop CI Researcher

Modes:
  web      → web queries only, RAG never mentioned
  internal → RAG queries only, web never mentioned
  hybrid   → both, full edit control over each list, re-confirm loop

Run:
  python3 main.py web
  python3 main.py internal
  python3 main.py hybrid
"""

import sys
import uuid
from langgraph.types import Command
from src.config import GraphConfig
from src.graph import build_graph
from src.state import AgentState
from src.db.postgres_checkpointer import get_checkpointer


def _edit_query_list(queries: list[str], label: str) -> list[str]:
    """Interactively edit a list of queries. Returns the updated list."""
    print(f"\n  Enter {label} query number to edit (1-{len(queries)}): ", end="")
    try:
        idx = int(input().strip()) - 1
        if not (0 <= idx < len(queries)):
            raise IndexError
        print(f"  Current : {queries[idx]}")
        print(f"  New     : ", end="")
        new_val = input().strip()
        if new_val:
            queries[idx] = new_val
            print(f"  ✅ Updated {label} query {idx + 1}")
        else:
            print(f"  ⚠️  Empty input — keeping original")
    except (ValueError, IndexError):
        print("  Invalid selection — no changes made")
    return queries


def _print_queries(queries: list[str], rag_queries: list[str], source_mode: str):
    """Print the current query lists based on mode."""
    if source_mode in ("web", "hybrid") and queries:
        print(f"\n  Web queries ({len(queries)}):")
        for i, q in enumerate(queries, 1):
            print(f"    {i}. {q}")

    if source_mode in ("internal", "hybrid") and rag_queries:
        print(f"\n  RAG queries ({len(rag_queries)}):")
        for i, q in enumerate(rag_queries, 1):
            print(f"    {i}. {q}")


def _hitl_web(queries: list[str]) -> list[str]:
    """HITL loop for web-only mode."""
    print(f"\n  Options:")
    print(f"    [A] Approve and run")
    print(f"    [E] Edit a query")
    print(f"    [Q] Quit")

    while True:
        choice = input("\n  Your choice: ").strip().upper()
        if choice == "Q":
            return None
        elif choice == "A":
            return queries
        elif choice == "E":
            queries = _edit_query_list(queries, "web")
            print(f"\n  Updated web queries:")
            for i, q in enumerate(queries, 1):
                print(f"    {i}. {q}")
        else:
            print("  Unrecognised option — use A, E, or Q")


def _hitl_internal(rag_queries: list[str]) -> list[str]:
    """HITL loop for internal-only mode."""
    print(f"\n  Options:")
    print(f"    [A] Approve and run")
    print(f"    [E] Edit a query")
    print(f"    [Q] Quit")

    while True:
        choice = input("\n  Your choice: ").strip().upper()
        if choice == "Q":
            return None
        elif choice == "A":
            return rag_queries
        elif choice == "E":
            rag_queries = _edit_query_list(rag_queries, "RAG")
            print(f"\n  Updated RAG queries:")
            for i, q in enumerate(rag_queries, 1):
                print(f"    {i}. {q}")
        else:
            print("  Unrecognised option — use A, E, or Q")


def _hitl_hybrid(queries: list[str], rag_queries: list[str]) -> tuple[list, list] | None:
    """HITL loop for hybrid mode — full edit control over both lists."""
    print(f"\n  Options:")
    print(f"    [A] Approve all and run")
    print(f"    [W] Edit a web query")
    print(f"    [R] Edit a RAG query")
    print(f"    [Q] Quit")

    while True:
        choice = input("\n  Your choice: ").strip().upper()

        if choice == "Q":
            return None

        elif choice == "A":
            # Final confirmation before running
            print(f"\n  ── Final query review ──────────────────────────")
            _print_queries(queries, rag_queries, "hybrid")
            print(f"\n  Confirm? [Y] Run / [N] Keep editing: ", end="")
            confirm = input().strip().upper()
            if confirm == "Y":
                return queries, rag_queries
            else:
                print(f"\n  Options:")
                print(f"    [A] Approve all and run")
                print(f"    [W] Edit a web query")
                print(f"    [R] Edit a RAG query")
                print(f"    [Q] Quit")

        elif choice == "W":
            queries = _edit_query_list(queries, "web")
            print(f"\n  Current web queries:")
            for i, q in enumerate(queries, 1):
                print(f"    {i}. {q}")
            print(f"\n  More edits? [A] Approve / [W] Edit web / [R] Edit RAG / [Q] Quit")

        elif choice == "R":
            rag_queries = _edit_query_list(rag_queries, "RAG")
            print(f"\n  Current RAG queries:")
            for i, q in enumerate(rag_queries, 1):
                print(f"    {i}. {q}")
            print(f"\n  More edits? [A] Approve / [W] Edit web / [R] Edit RAG / [Q] Quit")

        else:
            print("  Unrecognised option — use A, W, R, or Q")


def run(
    topic:       str,
    source_mode: str       = "web",
    file_ids:    list[str] = None,
    thread_id:   str       = None,
):
    print("\n" + "="*58)
    print("  CI RESEARCHER — Multi-Agent System")
    print(f"  Mode      : {source_mode.upper()}")
    print(f"  Thread ID : {thread_id}")
    print("="*58)

    checkpointer = get_checkpointer()
    app          = build_graph(config=GraphConfig.from_env(), checkpointer=checkpointer)
    config       = {"configurable": {"thread_id": thread_id}}

    initial_state: AgentState = {
        "topic":             topic,
        "source_mode":       source_mode,
        "uploaded_file_ids": file_ids or [],
        "queries":           [],
        "rag_queries":       [],
        "docs":              [],
        "scored_docs":       [],
        "avg_credibility":   0.0,
        "gaps":              [],
        "analyst_verdict":   "SUFFICIENT",
        "iteration_count":   0,
        "max_iterations":    3,
        "report":            "",
        "report_confidence": 0.0,
        "delivery_results":  [],
        "delivery_status":   "pending",
        "messages":          [],
    }

    # ── Phase 1: run until interrupt ──────────────────────────────
    print("\n[MAIN] 🚀 Starting run — will pause at HITL checkpoint…")
    app.invoke(initial_state, config=config)

    state     = app.get_state(config)
    is_paused = bool(state.next)

    if not is_paused:
        final = app.get_state(config).values
        _print_final(final, thread_id)
        return final, thread_id

    # ── HITL checkpoint ───────────────────────────────────────────
    interrupt_data = state.tasks[0].interrupts[0].value

    print("\n" + "="*58)
    print("  ⏸  HUMAN-IN-THE-LOOP CHECKPOINT")
    print("="*58)
    print(f"\n  Topic      : {interrupt_data['topic']}")
    print(f"  Mode       : {source_mode.upper()}")

    queries     = list(interrupt_data["queries"])
    rag_queries = list(interrupt_data.get("rag_queries", []))

    # Show only what's relevant for this mode
    _print_queries(queries, rag_queries, source_mode)

    # Route to the right HITL handler
    if source_mode == "web":
        result = _hitl_web(queries)
        if result is None:
            print("\n  Run cancelled.")
            return None, thread_id
        queries = result

    elif source_mode == "internal":
        result = _hitl_internal(rag_queries)
        if result is None:
            print("\n  Run cancelled.")
            return None, thread_id
        rag_queries = result

    elif source_mode == "hybrid":
        result = _hitl_hybrid(queries, rag_queries)
        if result is None:
            print("\n  Run cancelled.")
            return None, thread_id
        queries, rag_queries = result

    # ── Phase 2: resume with approved queries ─────────────────────
    print("\n[MAIN] ▶️  Resuming graph…\n")

    approved = {"queries": queries, "rag_queries": rag_queries}
    result   = app.invoke(Command(resume=approved), config=config)

    _print_final(result, thread_id)
    return result, thread_id


def _print_final(result: dict, thread_id: str):
    print("\n" + "="*58)
    print("FINAL REPORT:")
    print("="*58)
    print(result.get("report", "(no report generated)"))
    print(f"\nDelivery status : {result.get('delivery_status', '—')}")
    print(f"Avg credibility : {result.get('avg_credibility', 0.0):.2f}")
    print(f"Total sources   : {len(result.get('scored_docs', []))}")
    print(f"Thread ID       : {thread_id}")
    print("="*58)


if __name__ == "__main__":
    mode      = sys.argv[1] if len(sys.argv) > 1 else "web"
    thread_id = str(uuid.uuid4())

    run(
        topic="tell me about this person",
        source_mode=mode,
        thread_id=thread_id,
    )