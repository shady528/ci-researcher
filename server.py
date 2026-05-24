"""
server.py — FastAPI backend for CI Researcher

Endpoints:
  POST /api/upload                   Upload and ingest a file into ChromaDB
  POST /api/run                      Start a new research run
  GET  /api/stream/{thread_id}       SSE stream of agent events
  POST /api/hitl/{thread_id}/approve Approve/edit HITL queries
  GET  /api/run/{thread_id}/status   Poll run status

Run with:
  uvicorn server:app --reload --port 8000
"""

import asyncio
import json
import os
import queue as sync_queue
import re
import tempfile
import threading
import time
import uuid
from typing import AsyncGenerator, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel, Field

from src.config import GraphConfig, LLMConfig
from src.db.postgres_checkpointer import get_checkpointer
from src.graph import build_graph
from src.state import AgentState
from src.tools.ingest import ingest_file, delete_session as chroma_delete_session

# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="CI Researcher API",
    description="""
## Multi-Agent Competitive Intelligence Researcher

Powered by **LangGraph** + **GPT-4o** + **Tavily** + **ChromaDB**.

### Flow
1. `POST /api/upload` → upload files, get `file_id` back
2. `POST /api/run` → start run with `file_ids`
3. `GET /api/stream/{thread_id}` → SSE stream
4. On `hitl_pause` → `POST /api/hitl/{thread_id}/approve`
5. Stream until `run_complete`

### SSE Event Types
| Event | Description |
|-------|-------------|
| `node_start` | A node became active |
| `node_complete` | A node finished |
| `hitl_pause` | Waiting for human approval |
| `scored_docs` | Credibility scores ready |
| `report_ready` | Final report generated |
| `delivery_done` | Slack/email delivery complete |
| `run_complete` | Full run finished |
| `error` | Something went wrong |
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Run registry ─────────────────────────────────────────────────────

class RunState:
    def __init__(self, thread_id: str):
        self.thread_id      = thread_id
        self.q              = sync_queue.Queue()  # thread-safe, no asyncio needed
        self.hitl_event     = threading.Event()
        self.hitl_approval: Optional[dict] = None
        self.phase          = "starting"
        self.is_complete    = False
        self.error:  Optional[str] = None
        self.start_time     = time.time()

    def emit(self, event_type: str, data: dict):
        print(f"[EMIT] {event_type}")
        self.q.put({"event": event_type, "data": data})

    def close(self):
        self.q.put(None)


_runs: dict[str, RunState] = {}
_runs_lock = threading.Lock()

def _get_run(thread_id: str) -> Optional[RunState]:
    return _runs.get(thread_id)

def _create_run(thread_id: str) -> RunState:
    rs = RunState(thread_id)
    with _runs_lock:
        _runs[thread_id] = rs
    return rs


# ── Pydantic schemas ─────────────────────────────────────────────────

class UploadResponse(BaseModel):
    session_id: str
    filename:   str
    chunks:     int
    pages:      int

class ModelConfigIn(BaseModel):
    planner:      str  = "gpt-4o-mini"
    researcher:   str  = "gpt-4o-mini"
    validator:    str  = "gpt-4o-mini"
    analyst:      str  = "gpt-4o"
    writer:       str  = "gpt-4o"
    embedding:    str  = "text-embedding-3-small"
    depth:        str  = "standard"
    temperatures: dict = Field(default_factory=lambda: {
        "planner": 0.3, "researcher": 0.1, "analyst": 0.4, "writer": 0.7,
    })

class DeliveryConfigIn(BaseModel):
    slack_enabled: bool = False
    slack_target:  str  = ""
    email_enabled: bool = False
    email_target:  str  = ""

class RunRequest(BaseModel):
    topic:           str
    source_mode:     str       = Field("web", description="web | internal | hybrid")
    file_ids:        List[str] = Field(default_factory=list)
    session_id:      str       = Field("", description="Session ID from /api/upload")
    model_config_:   ModelConfigIn = Field(default_factory=ModelConfigIn, alias="model_config")
    focus:           Optional[str] = None
    domain_allow:    List[str] = Field(default_factory=list)
    domain_block:    List[str] = Field(default_factory=list)
    report_template: str       = Field("full", description="full | briefing | table")
    delivery:        DeliveryConfigIn = Field(default_factory=DeliveryConfigIn)

    class Config:
        populate_by_name = True

class RunResponse(BaseModel):
    thread_id:  str
    status:     str = "started"
    stream_url: str

class HitlApproveRequest(BaseModel):
    queries:     List[str]
    rag_queries: List[str] = Field(default_factory=list)

class HitlApproveResponse(BaseModel):
    ok:               bool
    thread_id:        str
    queries_approved: int

class StatusResponse(BaseModel):
    thread_id:   str
    phase:       str
    is_complete: bool
    elapsed_s:   float
    error:       Optional[str] = None


# ── Markdown → HTML ───────────────────────────────────────────────────

def md_to_html(md: str) -> str:
    html = md
    html = re.sub(r'^## (.+)$',      r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$',     r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$',       r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'\*\*(.+?)\*\*',  r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*',      r'<em>\1</em>', html)
    html = re.sub(r'`(.+?)`',        r'<code>\1</code>', html)
    html = re.sub(r'^\- (.+)$',      r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'(<li>.*</li>\n?)+', r'<ul>\g<0></ul>', html)
    chunks = [
        f'<p>{c.strip()}</p>' if c.strip() and not c.strip().startswith('<') else c.strip()
        for c in html.split('\n\n') if c.strip()
    ]
    return '\n'.join(chunks)


# ── Graph runner ──────────────────────────────────────────────────────

def _run_graph(rs: RunState, req: RunRequest, thread_id: str):
    try:
        checkpointer = get_checkpointer()
        mc           = req.model_config_
        api_key      = os.getenv("OPENAI_API_KEY", "")
        graph_config = GraphConfig(
            planner=LLMConfig(
                model=mc.planner,
                temperature=mc.temperatures.get("planner", 0.2),
                api_key=api_key,
            ),
            validator=LLMConfig(
                model=mc.validator,
                temperature=0.0,
                api_key=api_key,
            ),
            analyst=LLMConfig(
                model=mc.analyst,
                temperature=mc.temperatures.get("analyst", 0.1),
                api_key=api_key,
            ),
            report_gen=LLMConfig(
                model=mc.writer,
                temperature=mc.temperatures.get("writer", 0.2),
                api_key=api_key,
            ),
        )
        graph        = build_graph(config=graph_config, checkpointer=checkpointer)
        config       = {"configurable": {"thread_id": thread_id}}

        initial: AgentState = {
            "topic":             req.topic,
            "source_mode":       req.source_mode,
            "uploaded_file_ids": req.file_ids,
            "session_id":        req.session_id,
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

        rs.phase = "planning"
        rs.emit("node_start", {
            "node": "planner", "label": "Planner Node",
            "message": "Building your research plan…", "percent": 7,
        })

        approved: Optional[dict] = None

        for chunk in graph.stream(initial, config, stream_mode="updates"):
            if "__interrupt__" in chunk:
                iv    = chunk["__interrupt__"][0].value
                web_q = iv.get("queries",    [])
                rag_q = iv.get("rag_queries", [])

                rs.emit("node_complete", {
                    "node": "planner", "label": "Planner Node",
                    "badge": f"{len(web_q) + len(rag_q)} queries",
                    "body": (
                        f"<strong style='color:var(--text)'>Search plan generated:</strong><br>"
                        + (f"🌐 {len(web_q)} web queries" if web_q else "")
                        + (f" · 📁 {len(rag_q)} RAG queries" if rag_q else "")
                    ),
                })
                rs.emit("hitl_pause", {
                    "queries":     web_q,
                    "rag_queries": rag_q,
                    "topic":       req.topic,
                    "source_mode": req.source_mode,
                })

                rs.phase = "hitl"
                rs.hitl_event.wait()
                approved = rs.hitl_approval or {"queries": web_q, "rag_queries": rag_q}
                rs.phase = "running"
                break

        if approved is None:
            rs.emit("run_complete", {
                "thread_id": thread_id,
                "elapsed":   round(time.time() - rs.start_time, 1),
            })
            return

        # Researcher start message depends on mode
        mode_msg = {
            "web":      "Searching the web for information…",
            "internal": "Searching your internal documents…",
            "hybrid":   "Searching the web and your documents…",
        }.get(req.source_mode, "Researching…")

        rs.emit("node_start", {
            "node": "researcher", "label": "Researcher Node",
            "message": mode_msg, "percent": 28,
        })

        for chunk in graph.stream(Command(resume=approved), config, stream_mode="updates"):
            _handle_chunk(chunk, rs)

        rs.emit("run_complete", {
            "thread_id": thread_id,
            "elapsed":   round(time.time() - rs.start_time, 1),
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        rs.error = str(exc)
        rs.emit("error", {"message": str(exc)})
    finally:
        rs.is_complete = True
        rs.close()


def _handle_chunk(chunk: dict, rs: RunState):
    for node, delta in chunk.items():
        if node == "__interrupt__":
            continue

        if node == "researcher":
            docs = delta.get("docs", [])
            rs.emit("node_complete", {
                "node": "researcher", "label": "Researcher Node",
                "badge": f"{len(docs)} docs",
                "body": f"<strong style='color:var(--text)'>{len(docs)} documents retrieved.</strong> Routing → Validator.",
            })
            rs.emit("node_start", {
                "node": "validator", "label": "Validator Node",
                "message": "Checking how reliable each source is…", "percent": 44,
            })

        elif node == "validator":
            scored = delta.get("scored_docs", [])
            avg    = float(delta.get("avg_credibility", 0.0))
            rs.emit("scored_docs", {
                "docs": [{
                    "url":         d.get("url_or_filename", ""),
                    "type":        d.get("source_type", "blog"),
                    "credibility": d.get("credibility_score", 0.5),
                    "recency":     d.get("recency_score", 0.5),
                } for d in scored],
                "avg_credibility": avg,
            })
            rs.emit("node_complete", {
                "node": "validator", "label": "Validator Node",
                "badge": f"avg {avg:.2f}",
                "body": f"Credibility scores assigned. Avg: <strong style='color:var(--text)'>{avg:.2f}</strong>. Routing → Analyst.",
            })
            rs.emit("node_start", {
                "node": "analyst", "label": "Analyst Node",
                "message": "Reviewing what we found — checking for gaps…", "percent": 58,
            })

        elif node == "analyst":
            verdict = delta.get("analyst_verdict", "SUFFICIENT")
            gaps    = delta.get("gaps", [])
            if verdict == "INSUFFICIENT" and gaps:
                rs.emit("node_complete", {
                    "node": "analyst", "label": "Analyst Node",
                    "badge": f"{len(gaps)} gaps",
                    "body": (
                        f"<strong style='color:var(--text)'>verdict: INSUFFICIENT</strong><br>"
                        f"{len(gaps)} gap(s) found. Sending Researcher back out…"
                    ),
                })
                rs.emit("node_start", {
                    "node": "researcher", "label": "Researcher Node",
                    "message": "Filling research gaps…", "percent": 66,
                })
            else:
                rs.emit("node_complete", {
                    "node": "analyst", "label": "Analyst Node",
                    "badge": "Approved ✓",
                    "body": "<strong style='color:var(--text)'>verdict: SUFFICIENT</strong><br>Routing → Report Generator.",
                })
                rs.emit("node_start", {
                    "node": "generate_report", "label": "Report Generator",
                    "message": "Writing your report…", "percent": 88,
                })

        elif node == "generate_report":
            report_md  = delta.get("report", "")
            confidence = float(delta.get("report_confidence", 0.0))
            rs.emit("report_ready", {
                "report_html": md_to_html(report_md),
                "report_md":   report_md,
                "confidence":  confidence,
            })
            rs.emit("node_complete", {
                "node": "generate_report", "label": "Report Generator",
                "badge": "Done ✓", "body": "Report synthesized and ready.",
            })
            rs.emit("node_start", {
                "node": "notifier", "label": "Notifier Node",
                "message": "Delivering your report…", "percent": 95,
            })

        elif node == "notifier":
            results = delta.get("delivery_results", [])
            status  = delta.get("delivery_status",  "skipped")
            rs.emit("delivery_done", {
                "results": [{
                    "channel":     r.get("channel"),
                    "success":     r.get("success", False),
                    "status_code": r.get("status_code", 0),
                } for r in results],
                "status": status,
            })
            rs.emit("node_complete", {
                "node": "notifier", "label": "Notifier Node",
                "badge": "Sent ✓",
                "body": f"<strong style='color:var(--text)'>Delivery complete.</strong> Status: {status}",
            })


# ── Routes ────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "CI Researcher API", "version": "1.0.0"}


@app.post(
    "/api/upload",
    response_model=UploadResponse,
    tags=["Files"],
    summary="Upload and ingest a file into ChromaDB for this session",
)
async def upload_file(
    file:       UploadFile = File(...),
    session_id: str        = "",
):
    """
    Upload a PDF, DOCX, TXT, XLSX, or CSV file.
    All chunks are tagged with session_id.
    Pass the same session_id to POST /api/run so RAG is scoped correctly.
    """
    allowed = {".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls", ".csv"}
    ext     = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type '{ext}'. Allowed: {allowed}")

    if not session_id:
        session_id = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content  = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = ingest_file(
            file_path=tmp_path,
            filename=file.filename or "upload",
            session_id=session_id,
        )
    except Exception as e:
        raise HTTPException(500, f"Ingestion failed: {e}")
    finally:
        os.unlink(tmp_path)

    return UploadResponse(**result)


@app.delete(
    "/api/session/{session_id}",
    tags=["Files"],
    summary="Delete all ChromaDB embeddings for a session",
)
async def delete_session_endpoint(session_id: str):
    """
    Called when the user resets the UI.
    Deletes all ChromaDB chunks tagged with this session_id.
    """
    count = chroma_delete_session(session_id)
    return {"ok": True, "deleted_chunks": count, "session_id": session_id}


@app.post("/api/run", response_model=RunResponse, tags=["Agent"],
          summary="Start a new research run")
async def start_run(request: RunRequest):
    thread_id = str(uuid.uuid4())
    rs        = _create_run(thread_id)

    t = threading.Thread(
        target=_run_graph, args=(rs, request, thread_id), daemon=True
    )
    t.start()

    return RunResponse(
        thread_id=thread_id,
        status="started",
        stream_url=f"/api/stream/{thread_id}",
    )


@app.get("/api/stream/{thread_id}", tags=["Agent"],
         summary="SSE stream of agent events")
async def stream_events(thread_id: str):
    rs = _get_run(thread_id)
    if not rs:
        raise HTTPException(404, f"Run '{thread_id}' not found")

    async def generator() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'event': 'connected', 'data': {'thread_id': thread_id}})}\n\n"
        loop = asyncio.get_running_loop()
        while True:
            try:
                item = await asyncio.wait_for(
                    loop.run_in_executor(None, rs.q.get, True, 1.0),
                    timeout=35.0,
                )
            except (asyncio.TimeoutError, Exception):
                yield ": keepalive\n\n"
                continue
            if item is None:
                yield f"data: {json.dumps({'event': 'done', 'data': {}})}\n\n"
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/hitl/{thread_id}/approve", response_model=HitlApproveResponse,
          tags=["HITL"], summary="Approve search queries at the HITL checkpoint")
async def approve_hitl(thread_id: str, request: HitlApproveRequest):
    rs = _get_run(thread_id)
    if not rs:
        raise HTTPException(404, f"Run '{thread_id}' not found")
    if rs.phase != "hitl":
        raise HTTPException(400, f"Run is not at HITL checkpoint (phase: {rs.phase})")

    rs.hitl_approval = {
        "queries":     request.queries,
        "rag_queries": request.rag_queries,
    }
    rs.hitl_event.set()

    return HitlApproveResponse(
        ok=True, thread_id=thread_id,
        queries_approved=len(request.queries),
    )


@app.get("/api/run/{thread_id}/status", response_model=StatusResponse,
         tags=["Agent"], summary="Poll run status")
async def get_status(thread_id: str):
    rs = _get_run(thread_id)
    if not rs:
        raise HTTPException(404, f"Run '{thread_id}' not found")
    return StatusResponse(
        thread_id=thread_id, phase=rs.phase,
        is_complete=rs.is_complete,
        elapsed_s=round(time.time() - rs.start_time, 1),
        error=rs.error,
    )


@app.get("/api/test-sse", tags=["Health"])
async def test_sse():
    """Verify SSE delivery works independently of the graph."""
    async def gen():
        for i in range(5):
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'event': 'test', 'data': {'count': i}})}\n\n"
        yield f"data: {json.dumps({'event': 'done', 'data': {}})}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})
