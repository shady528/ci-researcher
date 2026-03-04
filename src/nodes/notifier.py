"""
nodes/notifier.py — Slack + Email delivery

Runs as the final node after Report Generator.
Independently toggleable — Slack and Email can be on/off separately.
All delivery results written to state["delivery_results"] for the DB log.

Slack:  POST Block Kit JSON to webhook URL (no OAuth needed)
Email:  SendGrid v3 API with HTML-formatted report body
        Falls back to smtplib if SENDGRID_API_KEY not set
"""

import os
import json
import smtplib
import urllib.request
import urllib.error
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────
SLACK_WEBHOOK_URL     = os.getenv("SLACK_WEBHOOK_URL", "")
SENDGRID_API_KEY      = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL   = os.getenv("SENDGRID_FROM_EMAIL", "")
REPORT_RECIPIENT_EMAIL = os.getenv("REPORT_RECIPIENT_EMAIL", "")

# SMTP fallback (Gmail example)
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


# ── Slack delivery ────────────────────────────────────────────────

def _build_slack_blocks(state: dict) -> list:
    """Build Slack Block Kit message for the completed report."""
    topic       = state["topic"]
    avg_cred    = state.get("avg_credibility", 0.0)
    source_count = len(state.get("scored_docs", []))
    iterations  = state.get("iteration_count", 0)
    report      = state.get("report", "")
    timestamp   = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Confidence badge
    if avg_cred >= 0.75:
        cred_emoji = "🟢"
        cred_label = "High Confidence"
    elif avg_cred >= 0.50:
        cred_emoji = "🟡"
        cred_label = "Moderate Confidence"
    else:
        cred_emoji = "🔴"
        cred_label = "Low Confidence"

    # Extract executive summary (first 300 chars of report after heading)
    summary = ""
    lines = report.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("## Executive Summary"):
            # Grab next non-empty lines up to 300 chars
            for l in lines[i+1:]:
                if l.strip() and not l.startswith("#"):
                    summary += l.strip() + " "
                if len(summary) >= 300:
                    break
            break
    if not summary:
        summary = report[:300]
    summary = summary[:300].strip() + "…"

    return [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📊 CI Report: {topic[:60]}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Confidence*\n{cred_emoji} {avg_cred:.2f} — {cred_label}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Sources*\n📄 {source_count} docs analyzed"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Iterations*\n🔁 {iterations} research loop(s)"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Completed*\n🕐 {timestamp}"
                }
            ]
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Executive Summary*\n{summary}"
            }
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "CI Researcher Multi-Agent System | Full report in email"
                }
            ]
        }
    ]


def _send_slack(state: dict) -> dict:
    """POST Block Kit message to Slack webhook."""
    if not SLACK_WEBHOOK_URL:
        print("  ⏭  Slack: no webhook URL configured — skipping")
        return {"channel": "slack", "recipient": "N/A",
                "status_code": 0, "success": False}

    payload = json.dumps({
        "blocks": _build_slack_blocks(state)
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            SLACK_WEBHOOK_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            print(f"  ✅ Slack: {status} OK — posted to channel")
            return {"channel": "slack", "recipient": "configured channel",
                    "status_code": status, "success": True}

    except urllib.error.HTTPError as e:
        print(f"  ❌ Slack: HTTP {e.code} — {e.reason}")
        return {"channel": "slack", "recipient": "configured channel",
                "status_code": e.code, "success": False}
    except Exception as e:
        print(f"  ❌ Slack: {e}")
        return {"channel": "slack", "recipient": "configured channel",
                "status_code": 0, "success": False}


# ── Email delivery ────────────────────────────────────────────────

def _markdown_to_html(md: str) -> str:
    """
    Minimal Markdown → HTML conversion for email body.
    Handles: headers, bold, tables, horizontal rules, bullet lists.
    No external dependency — stdlib only.
    """
    import re
    lines   = md.split("\n")
    html    = []
    in_table = False
    in_list  = False

    for line in lines:
        # Horizontal rule
        if line.strip() == "---":
            if in_list:
                html.append("</ul>")
                in_list = False
            html.append("<hr>")
            continue

        # Headers
        if line.startswith("### "):
            html.append(f"<h3>{line[4:]}</h3>")
            continue
        if line.startswith("## "):
            html.append(f"<h2 style='color:#1a1a2e;border-bottom:1px solid #eee;"
                        f"padding-bottom:4px'>{line[3:]}</h2>")
            continue
        if line.startswith("# "):
            html.append(f"<h1 style='color:#0f3460'>{line[2:]}</h1>")
            continue

        # Table rows
        if line.startswith("|"):
            if not in_table:
                html.append('<table style="border-collapse:collapse;width:100%;'
                            'margin:12px 0"><tbody>')
                in_table = True
            if re.match(r"\|[-| :]+\|", line):
                continue   # skip separator row
            cells = [c.strip() for c in line.split("|")[1:-1]]
            row   = "".join(
                f'<td style="border:1px solid #ddd;padding:6px 10px">{c}</td>'
                for c in cells
            )
            html.append(f"<tr>{row}</tr>")
            continue
        else:
            if in_table:
                html.append("</tbody></table>")
                in_table = False

        # Bullet lists
        if line.startswith("- ") or line.startswith("* "):
            if not in_list:
                html.append("<ul>")
                in_list = True
            item = line[2:]
            item = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", item)
            html.append(f"<li>{item}</li>")
            continue
        else:
            if in_list:
                html.append("</ul>")
                in_list = False

        # Inline bold
        line = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", line)

        if line.strip():
            html.append(f"<p style='margin:6px 0'>{line}</p>")
        else:
            html.append("<br>")

    if in_table:
        html.append("</tbody></table>")
    if in_list:
        html.append("</ul>")

    return "\n".join(html)


def _build_email_html(state: dict) -> str:
    """Wrap report markdown in a styled HTML email template."""
    topic      = state["topic"]
    avg_cred   = state.get("avg_credibility", 0.0)
    src_count  = len(state.get("scored_docs", []))
    iterations = state.get("iteration_count", 0)
    report_md  = state.get("report", "")
    timestamp  = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    cred_color = "#27ae60" if avg_cred >= 0.75 else \
                 "#f39c12" if avg_cred >= 0.50 else "#e74c3c"

    body_html = _markdown_to_html(report_md)

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;
             padding:20px;color:#333">

  <div style="background:#0f3460;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">📊 CI Research Report</h1>
    <p style="margin:6px 0 0;opacity:0.85">{topic}</p>
  </div>

  <div style="background:#f8f9fa;padding:16px;display:flex;gap:20px;
              border:1px solid #dee2e6;flex-wrap:wrap">
    <div style="text-align:center;flex:1;min-width:120px">
      <div style="font-size:28px;font-weight:bold;color:{cred_color}">
        {avg_cred:.2f}
      </div>
      <div style="font-size:12px;color:#666">Confidence Score</div>
    </div>
    <div style="text-align:center;flex:1;min-width:120px">
      <div style="font-size:28px;font-weight:bold;color:#0f3460">{src_count}</div>
      <div style="font-size:12px;color:#666">Sources Analyzed</div>
    </div>
    <div style="text-align:center;flex:1;min-width:120px">
      <div style="font-size:28px;font-weight:bold;color:#0f3460">{iterations}</div>
      <div style="font-size:12px;color:#666">Research Loops</div>
    </div>
    <div style="text-align:center;flex:1;min-width:120px">
      <div style="font-size:13px;font-weight:bold;color:#0f3460">{timestamp}</div>
      <div style="font-size:12px;color:#666">Completed</div>
    </div>
  </div>

  <div style="padding:24px;border:1px solid #dee2e6;border-top:none;
              border-radius:0 0 8px 8px;background:white">
    {body_html}
  </div>

  <div style="margin-top:16px;font-size:11px;color:#999;text-align:center">
    Generated by CI Researcher Multi-Agent System
  </div>

</body>
</html>"""


def _send_email_sendgrid(state: dict, recipient: str) -> dict:
    """Send styled HTML email via SendGrid v3 API."""
    topic   = state["topic"]
    payload = json.dumps({
        "personalizations": [{"to": [{"email": recipient}]}],
        "from":             {"email": SENDGRID_FROM_EMAIL},
        "subject":          f"CI Report: {topic[:80]}",
        "content": [
            {"type": "text/html", "value": _build_email_html(state)}
        ]
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type":  "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            print(f"  ✅ Email (SendGrid): {status} — sent to {recipient}")
            return {"channel": "email", "recipient": recipient,
                    "status_code": status, "success": True}

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"  ❌ Email (SendGrid): HTTP {e.code} — {body[:200]}")
        return {"channel": "email", "recipient": recipient,
                "status_code": e.code, "success": False}
    except Exception as e:
        print(f"  ❌ Email (SendGrid): {e}")
        return {"channel": "email", "recipient": recipient,
                "status_code": 0, "success": False}


def _send_email_smtp(state: dict, recipient: str) -> dict:
    """SMTP fallback — uses smtplib (zero extra dependencies)."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print("  ⏭  Email (SMTP): no credentials configured — skipping")
        return {"channel": "email", "recipient": recipient,
                "status_code": 0, "success": False}

    topic = state["topic"]
    msg   = MIMEMultipart("alternative")
    msg["Subject"] = f"CI Report: {topic[:80]}"
    msg["From"]    = SMTP_USER
    msg["To"]      = recipient

    html_part = MIMEText(_build_email_html(state), "html")
    text_part = MIMEText(state.get("report", ""), "plain")
    msg.attach(text_part)
    msg.attach(html_part)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, recipient, msg.as_string())
        print(f"  ✅ Email (SMTP): sent to {recipient}")
        return {"channel": "email", "recipient": recipient,
                "status_code": 250, "success": True}
    except Exception as e:
        print(f"  ❌ Email (SMTP): {e}")
        return {"channel": "email", "recipient": recipient,
                "status_code": 0, "success": False}


def _send_email(state: dict) -> dict:
    """Route to SendGrid or SMTP based on available config."""
    recipient = REPORT_RECIPIENT_EMAIL
    if not recipient:
        print("  ⏭  Email: no recipient configured — skipping")
        return {"channel": "email", "recipient": "N/A",
                "status_code": 0, "success": False}

    if SENDGRID_API_KEY:
        return _send_email_sendgrid(state, recipient)
    else:
        print("  ⚠️  No SendGrid key — trying SMTP fallback")
        return _send_email_smtp(state, recipient)


# ── The Node ─────────────────────────────────────────────────────

def notifier_node(state: dict) -> dict:
    print(f"\n[NOTIFIER] 🚀 Delivering report")
    print(f"  Topic      : {state['topic']}")
    print(f"  Confidence : {state.get('avg_credibility', 0):.2f}")
    print(f"  Sources    : {len(state.get('scored_docs', []))}")

    results = []

    # ── Slack ─────────────────────────────────────────────────────
    slack_result = _send_slack(state)
    results.append(slack_result)

    # ── Email ─────────────────────────────────────────────────────
    email_result = _send_email(state)
    results.append(email_result)

    # Overall status
    successes = [r for r in results if r["success"]]
    failures  = [r for r in results if not r["success"]]

    if successes and not failures:
        status = "sent"
    elif successes and failures:
        status = "partial"
    elif not any(r["status_code"] for r in results):
        status = "skipped"   # nothing configured
    else:
        status = "failed"

    print(f"\n  Delivery status: {status.upper()} "
          f"({len(successes)} succeeded, {len(failures)} failed/skipped)")

    return {
        "delivery_results": results,
        "delivery_status":  status,
    }