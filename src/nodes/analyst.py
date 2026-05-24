import os
import json
from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState, Gap

ANALYST_SYSTEM = """You are a senior competitive intelligence analyst with a critical eye.

Your job: evaluate whether the collected research is SUFFICIENT to write a comprehensive report on the given topic.

You will receive:
- The original research topic
- A list of scored source documents with their credibility scores
- The current iteration number

Evaluation criteria — ask yourself:
1. PRICING: Do we have concrete pricing data for ALL entities mentioned in the topic?
2. FEATURES: Do we have specific feature comparisons, not just vague descriptions?
3. RECENCY: Is the data current (2024-2025)? Flag anything older.
4. BALANCE: Do we have data from multiple source types (official + reviews + comparisons)?
5. COMPLETENESS: Are there major players, features, or angles the topic implies but we have NO data on?

Rules:
- Be strict. Vague blog summaries do NOT count as covering a topic.
- A source that mentions a company name without specifics does NOT count.
- If avg_credibility < 0.55, flag it as a gap.
- Max 3 gaps — focus on the most important missing pieces.
- If iteration >= 2, be more lenient — accept SUFFICIENT to avoid infinite loops.

Output ONLY valid JSON, no markdown, no explanation:
{
  "verdict": "SUFFICIENT" | "INSUFFICIENT",
  "reasoning": "one paragraph explaining your decision",
  "gaps": [
    {
      "description": "clear description of what is missing",
      "suggested_query": "exact search query to fill this gap"
    }
  ]
}

If verdict is SUFFICIENT, gaps must be an empty array []."""

ANALYST_HUMAN = """Research topic: {topic}
Current iteration: {iteration} of {max_iterations}
Documents collected: {doc_count}
Average credibility: {avg_cred:.2f}

=== SCORED DOCUMENTS ===
{docs_summary}

Evaluate completeness now."""


def _build_docs_summary(scored_docs: list, max_docs: int = 20) -> str:
    sorted_docs = sorted(
        scored_docs,
        key=lambda d: d["credibility_score"],
        reverse=True
    )[:max_docs]

    lines = []
    for i, doc in enumerate(sorted_docs, 1):
        lines.append(
            f"{i}. [{doc['credibility_score']:.2f}] [{doc['source_type']}]\n"
            f"   URL: {doc['url_or_filename']}\n"
            f"   Content: {doc['content'][:400]}…\n"
        )
    return "\n".join(lines)


def make_analyst_node(llm):
    def analyst_node(state: AgentState) -> dict:
        scored_docs  = state.get("scored_docs", [])
        iteration    = state["iteration_count"]
        max_iter     = state["max_iterations"]
        avg_cred     = state.get("avg_credibility", 0.0)

        print(f"\n[ANALYST] 🧠 Evaluating {len(scored_docs)} scored docs | "
              f"Iteration {iteration}/{max_iter} | Avg cred: {avg_cred:.2f}")

        if not scored_docs:
            print("  ⚠️  No scored docs — forcing INSUFFICIENT")
            return {
                "gaps": [{
                    "description": "No documents were collected",
                    "suggested_query": state["topic"] + " detailed overview 2025",
                    "resolved": False,
                }],
                "analyst_verdict": "INSUFFICIENT",
                "iteration_count": iteration + 1,
            }

        docs_summary = _build_docs_summary(scored_docs)

        messages = [
            SystemMessage(content=ANALYST_SYSTEM),
            HumanMessage(content=ANALYST_HUMAN.format(
                topic=state["topic"],
                iteration=iteration,
                max_iterations=max_iter,
                doc_count=len(scored_docs),
                avg_cred=avg_cred,
                docs_summary=docs_summary,
            ))
        ]

        response = llm.invoke(messages)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        parsed    = json.loads(raw.strip())
        verdict   = parsed.get("verdict", "SUFFICIENT")
        reasoning = parsed.get("reasoning", "")
        raw_gaps  = parsed.get("gaps", [])

        gaps: list[Gap] = [
            {
                "description":     g["description"],
                "suggested_query": g["suggested_query"],
                "resolved":        False,
            }
            for g in raw_gaps
        ]

        print(f"\n  Verdict: {'✅ SUFFICIENT' if verdict == 'SUFFICIENT' else '⚠️  INSUFFICIENT'}")
        print(f"  Reasoning: {reasoning}")

        if gaps:
            print(f"\n  Gaps found ({len(gaps)}):")
            for g in gaps:
                print(f"    🔍 {g['description']}")
                print(f"       Query: {g['suggested_query']}")

        return {
            "gaps":             gaps,
            "analyst_verdict":  verdict,
            "iteration_count":  iteration + 1,
        }

    return analyst_node