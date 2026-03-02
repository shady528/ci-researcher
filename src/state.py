from typing import Annotated, List, Optional, Literal
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
import operator


class SourceDoc(TypedDict):
    url_or_filename: str
    content: str
    source_type: Literal["official", "review_site", "reddit", "blog", "internal_doc"]
    credibility_score: float
    recency_score: float
    is_internal: bool
    published_date: Optional[str]


class Gap(TypedDict):
    description: str
    suggested_query: str
    resolved: bool


class DeliveryResult(TypedDict):
    channel: Literal["slack", "email"]
    recipient: str
    status_code: int
    success: bool


class AgentState(TypedDict):
    # ── Input ────────────────────────────────────────────────────
    topic: str
    source_mode: Literal["web", "internal", "hybrid"]
    uploaded_file_ids: List[str]

    # ── Planner output ───────────────────────────────────────────
    queries: List[str]
    rag_queries: List[str]

    # ── Researcher output ────────────────────────────────────────
    # operator.add = APPEND reducer. New docs from each iteration
    # are added to the list, never overwriting previous ones.
    # This is intentional — we accumulate all raw docs across loops.
    docs: Annotated[List[SourceDoc], operator.add]

    # ── Validator output ─────────────────────────────────────────
    # scored_docs is a PLAIN list (no reducer) — it gets fully
    # replaced by the Validator on every pass with the latest
    # credibility-scored version of all docs collected so far.
    # Downstream nodes (Analyst, Report) read from scored_docs,
    # not raw docs, so they always see the scored version.
    scored_docs: List[SourceDoc]
    avg_credibility: float

    # ── Analyst output ───────────────────────────────────────────
    gaps: List[Gap]
    analyst_verdict: Literal["SUFFICIENT", "INSUFFICIENT"]

    # ── Loop control ─────────────────────────────────────────────
    iteration_count: int
    max_iterations: int

    # ── Report Generator output ──────────────────────────────────
    report: str
    report_confidence: float

    # ── Notifier output ──────────────────────────────────────────
    delivery_results: List[DeliveryResult]
    delivery_status: Literal["pending", "sent", "failed", "skipped"]

    # ── Message history ──────────────────────────────────────────
    messages: Annotated[list, add_messages]