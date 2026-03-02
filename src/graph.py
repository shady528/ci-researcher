from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import InMemorySaver
from src.state import AgentState
from src.nodes.planner    import planner_node
from src.nodes.researcher import researcher_node
from src.nodes.validator  import validator_node
from src.nodes.analyst    import analyst_node
from src.nodes.report_gen import report_node        # ← REAL (Day 9)


def notifier_node(state: AgentState) -> dict:
    print(f"\n[NOTIFIER] 🚀 Stub — skipping (Week 4)")
    return {"delivery_results": [], "delivery_status": "skipped"}


def should_continue(state: AgentState) -> str:
    if state["iteration_count"] >= state["max_iterations"]:
        print(f"\n[ROUTER] ⚠️  Max iterations ({state['max_iterations']}) — forcing report")
        return "generate_report"
    if state["analyst_verdict"] == "INSUFFICIENT" and state["gaps"]:
        print(f"\n[ROUTER] ⚡ {len(state['gaps'])} gap(s) — looping back")
        return "researcher"
    print(f"\n[ROUTER] ✅ Analyst satisfied — proceeding to report")
    return "generate_report"


def build_graph(checkpointer=None):
    workflow = StateGraph(AgentState)
    workflow.add_node("planner",         planner_node)
    workflow.add_node("researcher",      researcher_node)
    workflow.add_node("validator",       validator_node)
    workflow.add_node("analyst",         analyst_node)
    workflow.add_node("generate_report", report_node)
    workflow.add_node("notifier",        notifier_node)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner",         "researcher")
    workflow.add_edge("researcher",      "validator")
    workflow.add_edge("validator",       "analyst")
    workflow.add_edge("generate_report", "notifier")
    workflow.add_edge("notifier",        END)

    workflow.add_conditional_edges(
        "analyst", should_continue,
        {"researcher": "researcher", "generate_report": "generate_report"}
    )
    checkpointer = checkpointer or InMemorySaver()
    return workflow.compile(checkpointer=checkpointer)