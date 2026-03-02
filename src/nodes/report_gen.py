import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState

load_dotenv()

# ── GPT-4o for synthesis ─────────────────────────────────────────
report_llm = init_chat_model(
    model="gpt-4o",
    model_provider="openai",
    temperature=0.2,
    api_key=os.getenv("OPENAI_API_KEY"),
)

REPORT_SYSTEM = """You are a senior competitive intelligence analyst writing a professional report.

Your report must be grounded ONLY in the source documents provided.
Do NOT invent pricing numbers, features, or statistics not present in the sources.
If data is uncertain, say "based on available sources" or "reported as of 2025".

Format your report in clean Markdown with these exact sections:

# [Topic] — Competitive Intelligence Report

## Executive Summary
2-3 paragraphs. What are the key takeaways a busy executive needs to know immediately?
Include the overall confidence score prominently.

## Pricing Comparison
A Markdown table with all pricing tiers found. Include notes on what's included/excluded.
If pricing is unclear, flag it explicitly rather than guessing.

## Feature Comparison
A Markdown table comparing key features side by side.
Rows = features, Columns = products.
Use ✅ / ❌ / ⚠️ (partial) for boolean features.

## Strengths & Weaknesses
For each product: 3-4 bullet strengths, 2-3 bullet weaknesses.
Base these on what sources actually say, not general knowledge.

## What's New in 2025
Key product updates, launches, or strategy shifts from 2025 sources only.

## Recommendation
Based purely on the data: who should use which product and why?
Be specific — "best for X type of company because Y".

## Source Credibility Summary
- Total sources: N
- High credibility (≥0.75): N sources
- Medium credibility (0.50–0.74): N sources  
- Low credibility (<0.50): N sources
- Overall confidence: X.XX

---
Rules:
- Use only information present in the provided sources
- Cite source URLs inline where specific facts are stated, e.g. (source: hubspot.com/pricing)
- Be specific with numbers when sources provide them
- Flag any area where data was thin or contradictory"""

REPORT_HUMAN = """Generate a competitive intelligence report on: {topic}

Overall confidence score: {avg_cred:.2f}
Total sources analyzed: {doc_count}
Research iterations: {iterations}

=== SOURCE DOCUMENTS (top {top_n} by credibility) ===

{docs_text}

Write the full report now."""


def _build_docs_text(scored_docs: list, max_docs: int = 25) -> str:
    """
    Build a detailed docs block for the synthesis prompt.
    Uses top docs by credibility — these are the most trustworthy sources.
    """
    top = sorted(
        scored_docs,
        key=lambda d: d["credibility_score"],
        reverse=True
    )[:max_docs]

    blocks = []
    for i, doc in enumerate(top, 1):
        blocks.append(
            f"--- Source {i} ---\n"
            f"URL: {doc['url_or_filename']}\n"
            f"Type: {doc['source_type']} | "
            f"Credibility: {doc['credibility_score']:.2f} | "
            f"Recency: {doc['recency_score']:.2f}\n"
            f"Content:\n{doc['content'][:600]}\n"
        )
    return "\n".join(blocks)


def report_node(state: AgentState) -> dict:
    scored_docs = state.get("scored_docs", [])
    avg_cred    = state.get("avg_credibility", 0.0)
    iterations  = state.get("iteration_count", 0)

    print(f"\n[REPORT] 📊 Synthesizing {len(scored_docs)} docs into report")
    print(f"  Avg credibility : {avg_cred:.2f}")
    print(f"  Iterations ran  : {iterations}")
    print(f"  Sending top 25 sources to GPT-4o for synthesis…")

    docs_text = _build_docs_text(scored_docs, max_docs=25)

    messages = [
        SystemMessage(content=REPORT_SYSTEM),
        HumanMessage(content=REPORT_HUMAN.format(
            topic=state["topic"],
            avg_cred=avg_cred,
            doc_count=len(scored_docs),
            iterations=iterations,
            top_n=min(25, len(scored_docs)),
            docs_text=docs_text,
        ))
    ]

    response  = report_llm.invoke(messages)
    report_md = response.content.strip()

    print(f"  ✅ Report generated ({len(report_md)} characters)")

    return {
        "report":            report_md,
        "report_confidence": avg_cred,
    }