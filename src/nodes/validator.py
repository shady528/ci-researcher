import os
import json
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from src.state import AgentState, SourceDoc

load_dotenv()

# ── GPT-4o-mini for scoring — fast and cheap ─────────────────────
# This is intentionally NOT GPT-4o. Credibility scoring is a
# classification task, not a reasoning task. 4o-mini is ~10x cheaper
# and performs identically here.
validator_llm = init_chat_model(
    model="gpt-4o-mini",
    model_provider="openai",
    temperature=0.0,   # zero temp = deterministic scores
    api_key=os.getenv("OPENAI_API_KEY"),
)

# ── Base scores by source type (heuristic floor) ─────────────────
# LLM can adjust UP from these but rarely below them.
BASE_SCORES = {
    "official":    0.80,
    "review_site": 0.65,
    "blog":        0.50,
    "reddit":      0.30,
    "internal_doc": 1.00,   # always trusted — it's your own data
}

CREDIBILITY_FLOOR = float(os.getenv("CREDIBILITY_FLOOR", 0.20))

# ── Prompt ───────────────────────────────────────────────────────
VALIDATOR_SYSTEM = """You are a source credibility analyst for an enterprise research system.

Score each source's credibility on a scale of 0.0 to 1.0 based on:
- source_type base score (official=0.80, review_site=0.65, blog=0.50, reddit=0.30)
- Domain authority: well-known domains score higher (salesforce.com, sec.gov → boost)
- Content quality signals: vague/thin content → reduce score
- Potential bias: vendor's own site → slight reduce for objectivity
- Cross-reference bonus: if content confirms facts seen in other sources → small boost

Rules:
- internal_doc sources always score exactly 1.0 — never change this
- Never score below 0.1 or above 1.0
- Be consistent — same domain should get similar scores
- Output ONLY valid JSON, no explanation, no markdown fences

Output schema — one entry per source, same order as input:
[
  {"url": "...", "credibility_score": 0.85, "reason": "one short sentence"},
  ...
]"""

VALIDATOR_HUMAN = """Score the credibility of these {count} sources:

{sources}

Return a JSON array with exactly {count} entries."""


def _batch(lst: list, size: int):
    """Split list into chunks of `size` for batched LLM calls."""
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def validator_node(state: AgentState) -> dict:
    docs = state["docs"]
    print(f"\n[VALIDATOR] 🛡  Scoring {len(docs)} docs with GPT-4o-mini")

    if not docs:
        print("  → No docs to score")
        return {"avg_credibility": 0.0}

    # Internal docs skip LLM — always 1.0
    internal = [d for d in docs if d["is_internal"]]
    external = [d for d in docs if not d["is_internal"]]

    scored_docs: list[SourceDoc] = list(internal)  # internals already trusted

    # Score external docs in batches of 10
    # (keeps prompt size manageable, reduces single-call failure risk)
    for batch in _batch(external, 10):
        sources_text = "\n".join(
            f"{i+1}. URL: {d['url_or_filename']}\n"
            f"   Type: {d['source_type']}\n"
            f"   Base score: {BASE_SCORES.get(d['source_type'], 0.5)}\n"
            f"   Content preview: {d['content'][:300]}…"
            for i, d in enumerate(batch)
        )

        messages = [
            SystemMessage(content=VALIDATOR_SYSTEM),
            HumanMessage(content=VALIDATOR_HUMAN.format(
                count=len(batch),
                sources=sources_text,
            ))
        ]

        try:
            response = validator_llm.invoke(messages)
            raw = response.content.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            scores = json.loads(raw.strip())

            for doc, score_data in zip(batch, scores):
                cred = float(score_data.get("credibility_score", 0.5))
                cred = max(CREDIBILITY_FLOOR, min(1.0, cred))  # clamp to [floor, 1.0]
                reason = score_data.get("reason", "")

                scored_doc = {**doc, "credibility_score": cred}
                scored_docs.append(scored_doc)

                # Print score for each doc
                bar = "█" * int(cred * 10) + "░" * (10 - int(cred * 10))
                print(f"  [{bar}] {cred:.2f}  [{doc['source_type']:12}]  "
                      f"{doc['url_or_filename'][:55]}")
                if reason:
                    print(f"          ↳ {reason}")

        except (json.JSONDecodeError, Exception) as e:
            print(f"  ⚠️  Scoring batch failed: {e} — using base scores")
            for doc in batch:
                base = BASE_SCORES.get(doc["source_type"], 0.5)
                scored_docs.append({**doc, "credibility_score": base})

    # Filter out sources below the credibility floor
    before_filter = len(scored_docs)
    scored_docs = [d for d in scored_docs if d["credibility_score"] >= CREDIBILITY_FLOOR]
    filtered = before_filter - len(scored_docs)
    if filtered:
        print(f"\n  🗑  Filtered {filtered} low-credibility sources "
              f"(below {CREDIBILITY_FLOOR})")

    # Compute average
    if scored_docs:
        avg = sum(d["credibility_score"] for d in scored_docs) / len(scored_docs)
    else:
        avg = 0.0

    # Summary by type
    by_type: dict[str, list[float]] = {}
    for d in scored_docs:
        by_type.setdefault(d["source_type"], []).append(d["credibility_score"])

    print(f"\n  📊 Credibility summary:")
    for stype, scores in sorted(by_type.items()):
        avg_t = sum(scores) / len(scores)
        print(f"     {stype:15} → {len(scores):2} docs, avg {avg_t:.2f}")
    print(f"\n  ✅ Overall avg credibility: {avg:.2f}")

    # IMPORTANT: We return the full rescored list.
    # Because docs uses operator.add (append reducer), we need to
    # signal graph to use scored_docs as the replacement.
    # We do this by overwriting state["docs"] via a full replacement.
    # In LangGraph, returning a key always REPLACES for non-annotated keys.
    # For the Annotated[List, operator.add] key, we return only the NEW items.
    # Since validator runs after researcher and we want to update scores,
    # we store scored results in a separate key and merge in report_node.
    # Simplest production approach: use a separate "scored_docs" key.
    # For now we return avg_credibility and attach scores inline.
    # ✅ Correct — "scored_docs" is a plain list, fully replaced each pass
    return {
    "avg_credibility": round(avg, 3),
    "scored_docs": scored_docs,
}