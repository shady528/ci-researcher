from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import InMemorySaver

from src.config import GraphConfig
from src.state import AgentState
from src.nodes.planner    import make_planner_node
from src.nodes.researcher import researcher_node
from src.nodes.validator  import make_validator_node
from src.nodes.analyst    import make_analyst_node
from src.nodes.report_gen import make_report_node
from src.nodes.notifier   import notifier_node


def should_continue(state: AgentState) -> str:
    if state["iteration_count"] >= state["max_iterations"]:
        print(f"\n[ROUTER] ⚠️  Max iterations ({state['max_iterations']}) — forcing report")
        return "generate_report"
    if state["analyst_verdict"] == "INSUFFICIENT" and state["gaps"]:
        print(f"\n[ROUTER] ⚡ {len(state['gaps'])} gap(s) — looping back")
        return "researcher"
    print(f"\n[ROUTER] ✅ Analyst satisfied — proceeding to report")
    return "generate_report"


def build_graph(config: GraphConfig = None, checkpointer=None):
    config = config or GraphConfig.from_env()

    planner_llm   = init_chat_model(model=config.planner.model,    model_provider="openai", temperature=config.planner.temperature,    api_key=config.planner.api_key)
    validator_llm = init_chat_model(model=config.validator.model,  model_provider="openai", temperature=config.validator.temperature,  api_key=config.validator.api_key)
    analyst_llm   = init_chat_model(model=config.analyst.model,    model_provider="openai", temperature=config.analyst.temperature,    api_key=config.analyst.api_key)
    report_llm    = init_chat_model(model=config.report_gen.model, model_provider="openai", temperature=config.report_gen.temperature, api_key=config.report_gen.api_key)

    workflow = StateGraph(AgentState)
    workflow.add_node("planner",         make_planner_node(planner_llm))
    workflow.add_node("researcher",      researcher_node)
    workflow.add_node("validator",       make_validator_node(validator_llm))
    workflow.add_node("analyst",         make_analyst_node(analyst_llm))
    workflow.add_node("generate_report", make_report_node(report_llm))
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
