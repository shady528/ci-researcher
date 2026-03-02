from src.graph import build_graph
from src.state import AgentState


def run(topic: str):
    print("\n" + "="*55)
    print("  CI RESEARCHER — Multi-Agent System")
    print("="*55)

    app = build_graph()

    initial_state: AgentState = {
        "topic": topic,
        "source_mode": "web",
        "uploaded_file_ids": [],
        "queries": [],
        "rag_queries": [],
        "docs": [],
        "scored_docs": [],        # ← new field
        "avg_credibility": 0.0,
        "gaps": [],
        "analyst_verdict": "SUFFICIENT",
        "iteration_count": 0,
        "max_iterations": 3,
        "report": "",
        "report_confidence": 0.0,
        "delivery_results": [],
        "delivery_status": "pending",
        "messages": [],
    }

    config = {"configurable": {"thread_id": "test-run-001"}}
    result = app.invoke(initial_state, config=config)

    print("\n" + "="*55)
    print("FINAL REPORT:")
    print("="*55)
    print(result["report"])
    print(f"\nDelivery status : {result['delivery_status']}")
    print(f"Avg credibility : {result['avg_credibility']:.2f}")
    print(f"Total sources   : {len(result.get('scored_docs', []))}")
    print("="*55)


if __name__ == "__main__":
    run("Samsung S26 Series lauch")