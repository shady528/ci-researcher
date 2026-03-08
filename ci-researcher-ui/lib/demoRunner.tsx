import { useAgentStore } from '@/store/agentStore'
import type { ThoughtCardData, ScoredDoc } from '@/types/agent'

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function gT() {
  return new Date().toTimeString().slice(0, 8)
}

let cardId = 0
function thought(
  avatar: ThoughtCardData['avatar'],
  label:  string,
  status: ThoughtCardData['status'],
  body:   string,
): ThoughtCardData {
  return { id: String(++cardId), avatar, label, status, body, timestamp: gT() }
}

function waitForApproval(): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (!useAgentStore.getState().hitlData) {
        clearInterval(check)
        resolve()
      }
    }, 200)
  })
}

function chips(items: string[], cls: string) {
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px">${
    items.map((q) => `<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:var(--bg);border:1px solid ${cls === 'r' ? 'var(--accent)' : cls === 'd' ? 'var(--green)' : 'rgba(157,127,240,.4)'};color:${cls === 'r' ? 'var(--accent)' : cls === 'd' ? 'var(--green)' : 'var(--purple)'};font-family:JetBrains Mono,monospace">${q}</span>`).join('')
  }</div>`
}

function sourceTable(docs: ScoredDoc[]) {
  const rows = docs.map((d) => {
    const tc = d.type === 'internal_doc' ? 'rgba(157,127,240,.1);color:var(--purple)'
             : d.type === 'official'     ? 'rgba(31,207,114,.1);color:var(--green)'
             : d.type === 'review_site'  ? 'rgba(91,127,255,.1);color:var(--accent)'
             : 'rgba(255,79,79,.08);color:var(--red)'
    const barColor = d.credibility >= 0.7 ? 'var(--green)' : d.credibility >= 0.4 ? 'var(--yellow)' : 'var(--red)'
    return `<tr>
      <td style="padding:5px 7px;font-size:10px;font-family:JetBrains Mono,monospace;color:var(--text2)">${d.url}</td>
      <td style="padding:5px 7px"><span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;background:${tc}">${d.type}</span></td>
      <td style="padding:5px 7px;font-size:10px;font-family:JetBrains Mono,monospace;color:var(--text2)">
        ${d.credibility.toFixed(2)}
        <div style="height:3px;width:${d.credibility * 60}px;background:${barColor};border-radius:2px;margin-top:2px"></div>
      </td>
    </tr>`
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px">
    <thead><tr>
      <th style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text3);padding:5px 7px;text-align:left;border-bottom:1px solid var(--border)">Source</th>
      <th style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text3);padding:5px 7px;text-align:left;border-bottom:1px solid var(--border)">Type</th>
      <th style="font-size:9px;font-weight:700;text-transform:uppercase;color:var(--text3);padding:5px 7px;text-align:left;border-bottom:1px solid var(--border)">Cred</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export async function runDemoSequence(): Promise<void> {
  const s = useAgentStore.getState()

  const topic = s.topic ||
    'Cross-reference our Q3 compliance policy docs with latest SEC guidelines and compare against top competitor disclosures'
  if (!s.topic) s.setTopic(topic)

  const isHybrid = s.sourceMode === 'hybrid' || s.uploadedFiles.length > 0

  s.setPhase('running')
  s.setIsRunning(true)

  // ── PLANNER ──────────────────────────────────────────────────
  s.setProgress('Building your research plan…', 7)
  s.setNodeStatus('planner', 'active')
  s.setStateSnapshot({ topic, queries: 'generating…', docs: [], gaps: [], iteration_count: 0, report: null, delivery_status: 'Pending' })

  s.addThought(thought('system', 'System', 'running',
    `Graph started. Entry point: <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">planner_node</code><br>
     Source mode: <strong style="color:var(--text)">${isHybrid ? 'Hybrid (Web + Internal RAG)' : 'Web Only'}</strong>
     ${s.uploadedFiles.length ? `<br>Docs indexed: ${s.uploadedFiles.map((f) => `<code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">${f.name}</code>`).join(', ')}` : ''}`
  ))

  await delay(1200)

  const webQ = [
    'HubSpot CRM pricing tiers 2025',
    'Salesforce SEC disclosure format 2025',
    'CRM competitors compliance frameworks',
    'G2 enterprise CRM audit reviews 2025',
  ]
  const intQ = isHybrid ? [
    '[RAG] Q3_Compliance_Policy.pdf → key clauses',
    '[RAG] Internal_Audit_Report_2024 → gap findings',
  ] : []
  const allQ = [...webQ, ...intQ]

  s.addThought(thought('planner', 'Planner Node', 'complete',
    `<strong style="color:var(--text)">Search plan generated:</strong><br>
     🌐 Web queries:${chips(webQ, 'd')}
     ${isHybrid ? `📁 Internal RAG queries:${chips(intQ, 'int')}` : ''}
     <br>Written to <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">state["queries"]</code>. Routing → Researcher.`
  ))

  s.setNodeStatus('planner', 'done')
  s.setNodeBadge('planner', `${allQ.length} queries`)

  // ── HITL ─────────────────────────────────────────────────────
  s.setProgress('Waiting for your approval before searching…', 14)
  s.setPhase('hitl')
  s.setHitlData({ webQueries: webQ, internalQueries: intQ })
  await waitForApproval()
  s.setPhase('running')

  // ── RESEARCHER pass 1 ────────────────────────────────────────
  s.setProgress(`Searching the ${isHybrid ? 'web and your documents' : 'web'} for information…`, 28)
  s.setNodeStatus('researcher', 'active')

  s.addThought(thought('researcher', 'Researcher Node', 'running',
    `Calling <strong style="color:var(--text)">2 tools in parallel:</strong><br>
     🌐 <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">WebSearchTool (Tavily)</code> — firing ${webQ.length} queries<br>
     ${isHybrid ? `📁 <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">InternalRAGTool (ChromaDB)</code> — querying ${s.uploadedFiles.length || 2} embedded docs` : ''}
     ${chips(webQ, 'r')}${isHybrid ? chips(intQ, 'int') : ''}`
  ))

  for (let i = 0; i < webQ.length; i++) {
    await delay(420)
    s.setWebDocs(s.webDocs + 5)
  }
  if (isHybrid) {
    for (let i = 0; i < intQ.length; i++) {
      await delay(480)
      s.setIntDocs(s.intDocs + 3)
    }
  }

  const pass1Docs: ScoredDoc[] = [
    { url:'sec.gov/disclosures/2025',   type:'official',     credibility:0.98, recency:0.97 },
    { url:'hubspot.com/pricing',        type:'official',     credibility:0.91, recency:0.90 },
    { url:'salesforce.com/compliance',  type:'official',     credibility:0.89, recency:0.85 },
    { url:'g2.com/crm-enterprise',      type:'review_site',  credibility:0.72, recency:0.88 },
    { url:'reddit.com/r/CRM/audit',     type:'reddit',       credibility:0.31, recency:0.75 },
    ...(isHybrid ? [
      { url:'Q3_Compliance_Policy.pdf',        type:'internal_doc' as const, credibility:1.00, recency:0.78 },
      { url:'Internal_Audit_Report_2024.docx', type:'internal_doc' as const, credibility:1.00, recency:0.82 },
    ] : []),
  ]

  s.addThought(thought('researcher', 'Researcher Node', 'complete',
    `<strong style="color:var(--text)">${useAgentStore.getState().webDocs + useAgentStore.getState().intDocs} documents retrieved.</strong> Routing → Validator.`
  ))
  s.setNodeStatus('researcher', 'done')
  s.setNodeBadge('researcher', `${useAgentStore.getState().webDocs + useAgentStore.getState().intDocs} docs`)

  // ── VALIDATOR pass 1 ─────────────────────────────────────────
  s.setProgress('Checking how reliable each source is…', 44)
  s.setNodeStatus('validator', 'active')

  s.addThought(thought('validator', 'Validator Node', 'running',
    `Analyzing <strong style="color:var(--text)">${pass1Docs.length} sources</strong>…<br>
     Running credibility heuristics: source_type → base score · recency → freshness · domain authority · internal docs → trusted (1.0)`
  ))

  await delay(1800)

  const avg1 = (pass1Docs.reduce((a, d) => a + d.credibility, 0) / pass1Docs.length).toFixed(2)
  s.setAvgCred(avg1)
  s.setScoredDocs(pass1Docs)

  s.addThought(thought('validator', 'Validator Node', 'complete',
    `Credibility scores assigned. Avg: <strong style="color:var(--text)">${avg1}</strong>${sourceTable(pass1Docs)}<br>Routing → Analyst.`
  ))
  s.setNodeStatus('validator', 'done')
  s.setNodeBadge('validator', `avg ${avg1}`)
  s.setStateSnapshot({ topic, queries: allQ, docs: pass1Docs, gaps: [], iteration_count: 0, report: null, delivery_status: 'Pending' })

  // ── ANALYST pass 1 ───────────────────────────────────────────
  s.setProgress('Reviewing what we found — checking for gaps…', 58)
  s.setNodeStatus('analyst', 'active')

  const checkOk   = (t: string) => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;padding:5px 9px;border-radius:5px;background:rgba(31,207,114,.04);border:1px solid rgba(31,207,114,.14);color:var(--green);margin-bottom:3px"><span>✅</span>${t}</div>`
  const checkWarn = (t: string) => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;padding:5px 9px;border-radius:5px;background:rgba(240,192,64,.04);border:1px solid rgba(240,192,64,.14);color:var(--yellow);margin-bottom:3px"><span>⚠️</span>${t}</div>`

  s.addThought(thought('analyst', 'Analyst Node', 'running',
    `Self-reflection checklist:<br>
     ${checkOk('SEC compliance guidelines (2025, cred 0.98)')}
     ${checkOk('HubSpot & Salesforce pricing confirmed')}
     ${isHybrid ? checkOk(`Internal Q3 policy — ${s.uploadedFiles[0]?.name || 'doc'} (cred 1.0)`) : ''}
     ${checkWarn('Pipedrive compliance posture — no data found')}
     ${checkWarn('Monday CRM regulatory disclosures missing')}`
  ))

  await delay(1400)

  const gaps = ['Pipedrive compliance/regulatory posture not found', 'Monday CRM SEC-related disclosures missing']
  s.setGapStat(`0/${gaps.length}`)

  s.addThought(thought('analyst', 'Analyst Node', 'gap',
    `<strong style="color:var(--text)">verdict: INSUFFICIENT</strong><br>
     Gaps written to <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">state["gaps"]</code>:<br>
     ${gaps.map(g => checkWarn(g)).join('')}
     Routing → Supervisor → Researcher (iteration 1).`
  ))

  s.setNodeStatus('analyst', 'done')
  s.setNodeBadge('analyst', '2 gaps')
  s.setShowCondEdge(true)
  s.setIterText('Iteration 1 / 3 max')
  s.setProgress('Some information was missing — searching again to fill the gaps…', 66)
  s.setStateSnapshot({ topic, queries: allQ, docs: pass1Docs, gaps, iteration_count: 1, report: null, delivery_status: 'Pending' })

  await delay(700)

  // ── RESEARCHER pass 2 ────────────────────────────────────────
  s.setNodeStatus('researcher', 'active')
  s.setNodeBadge('researcher', 'filling…')

  const gapQ = ['Pipedrive compliance framework 2025', 'Monday CRM SEC regulatory disclosures 2025']

  s.addThought(thought('researcher', 'Researcher Node', 'running',
    `Gap-targeted queries:${chips(gapQ, 'r')}<br>Appending to <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">state["docs"]</code>…`
  ))

  await delay(1800)
  s.setWebDocs(useAgentStore.getState().webDocs + 10)

  const gapDocs: ScoredDoc[] = [
    { url:'pipedrive.com/security', type:'official', credibility:0.87, recency:0.84 },
    { url:'monday.com/compliance',  type:'official', credibility:0.85, recency:0.88 },
  ]
  const allDocs = [...pass1Docs, ...gapDocs]

  s.addThought(thought('researcher', 'Researcher Node', 'complete',
    `10 new docs appended. Total: <strong style="color:var(--text)">${useAgentStore.getState().webDocs + useAgentStore.getState().intDocs}</strong> docs. Routing → Validator.`
  ))
  s.setNodeStatus('researcher', 'done')
  s.setNodeBadge('researcher', `${useAgentStore.getState().webDocs + useAgentStore.getState().intDocs} docs`)

  // ── VALIDATOR pass 2 ─────────────────────────────────────────
  s.setNodeStatus('validator', 'active')
  await delay(700)

  const avg2 = (allDocs.reduce((a, d) => a + d.credibility, 0) / allDocs.length).toFixed(2)
  s.setAvgCred(avg2)
  s.setScoredDocs(allDocs)

  s.addThought(thought('validator', 'Validator Node', 'complete',
    `New sources scored. Updated avg credibility: <strong style="color:var(--text)">${avg2}</strong>. Routing → Analyst.`
  ))
  s.setNodeStatus('validator', 'done')
  s.setNodeBadge('validator', `avg ${avg2}`)
  s.setProgress('Verifying the gaps are now filled…', 78)
  s.setStateSnapshot({ topic, queries: allQ, docs: allDocs, gaps: [], iteration_count: 1, report: null, delivery_status: 'Pending' })

  await delay(600)

  // ── ANALYST pass 2 ───────────────────────────────────────────
  s.setNodeStatus('analyst', 'active')

  s.addThought(thought('analyst', 'Analyst Node', 'running',
    `Re-evaluating ${allDocs.length} docs…<br>
     ${checkOk('SEC guidelines ✓')}
     ${checkOk('HubSpot & Salesforce compliance ✓')}
     ${checkOk('Pipedrive compliance posture ✓')}
     ${checkOk('Monday CRM disclosures ✓')}
     ${isHybrid ? checkOk('Internal Q3 policy & audit report ✓') : ''}`
  ))

  await delay(1200)
  s.setGapStat(`${gaps.length}/${gaps.length}`)

  s.addThought(thought('analyst', 'Analyst Node', 'complete',
    `<strong style="color:var(--text)">verdict: SUFFICIENT</strong><br>
     <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">state["gaps"] = []</code><br>
     All gaps resolved. Routing → Report Generator.`
  ))

  s.setNodeStatus('analyst', 'done')
  s.setNodeBadge('analyst', 'Approved ✓')
  s.setShowCondEdge(false)
  s.setIterText('Iteration 2 / 3 max')
  s.setProgress('Writing your report…', 88)
  s.setStateSnapshot({ topic, queries: allQ, docs: allDocs, gaps: [], iteration_count: 2, report: 'generating…', delivery_status: 'Pending' })

  await delay(700)

  // ── REPORT GENERATOR ─────────────────────────────────────────
  s.setNodeStatus('report', 'active')

  s.addThought(thought('report', 'Report Generator', 'running',
    `Synthesizing <strong style="color:var(--text)">${allDocs.length} validated docs</strong> into report…<br>
     • Executive Summary<br>• Feature + Compliance Matrix<br>
     ${isHybrid ? '• Internal Audit Findings <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(157,127,240,.1);color:var(--purple)">RAG</span><br>' : ''}
     • SEC Compliance Gap Analysis<br>• Trend Alerts + Recommendations`
  ))

  await delay(2200)

  const template = useAgentStore.getState().reportTemplate
  const reportMd = buildReportHTML(allDocs, avg2, isHybrid, s.uploadedFiles.map(f => f.name), template)
  s.setReportMd(reportMd)
  s.setNodeStatus('report', 'done')
  s.setNodeBadge('report', 'Done ✓')
  s.setProgress('Delivering your report…', 95)
  s.setStateSnapshot({ topic, queries: allQ, docs: allDocs, gaps: [], iteration_count: 2, report: '# CI Report', delivery_status: 'Sending…' })

  await delay(700)

  // ── NOTIFIER ─────────────────────────────────────────────────
  s.setNodeStatus('notifier', 'notify')
  const { delivery } = useAgentStore.getState()
  const channels: string[] = []
  if (delivery.slackEnabled) channels.push('Slack')
  if (delivery.emailEnabled) channels.push(`Email (${delivery.emailTarget})`)

  s.addThought(thought('notifier', 'Notifier Node', 'sending',
    `Dispatching report to: <strong style="color:var(--text)">${channels.length ? channels.join(' + ') : 'No channels configured'}</strong><br>
     ${delivery.slackEnabled ? `💬 Slack: posting Block Kit to webhook…<br>` : ''}
     ${delivery.emailEnabled ? `📧 Email: sending via SendGrid to <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">${delivery.emailTarget}</code>…<br>` : ''}`
  ))

  await delay(1600)

  s.setNodeStatus('notifier', 'done')
  s.setNodeBadge('notifier', 'Sent ✓')

  s.addThought(thought('notifier', 'Notifier Node', 'complete',
    `<strong style="color:var(--text)">All channels delivered.</strong><br>
     ${delivery.slackEnabled ? `💬 Slack: <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">200 OK</code> — thread posted<br>` : ''}
     ${delivery.emailEnabled ? `📧 Email: <code style="font-family:JetBrains Mono,monospace;font-size:10px;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:1px 4px;color:var(--accent)">202 Accepted</code> — SendGrid confirmed<br>` : ''}`
  ))

  s.setDeliveryResults([
    ...(delivery.slackEnabled ? [{ channel: 'slack'  as const, success: true, statusCode: 200, sentAt: gT() }] : []),
    ...(delivery.emailEnabled ? [{ channel: 'email'  as const, success: true, statusCode: 202, sentAt: gT() }] : []),
  ])

  s.setProgress('Your report is ready', 100)
  s.setStateSnapshot({ topic, queries: allQ, docs: allDocs, gaps: [], iteration_count: 2, report: '# CI Report', delivery_status: 'Delivered' })

    // Save to history
    try {
    const state = useAgentStore.getState()
    await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        topic:        topic,
        report_html:  reportMd,
        cred_label:   parseFloat(avg2) >= 0.75 ? 'Strong' : parseFloat(avg2) >= 0.5 ? 'Moderate' : 'Limited',
        source_count: state.webDocs + state.intDocs,
        elapsed:      state.elapsed,
        }),
    })
    } catch (err) {
    console.warn('Failed to save report to history', err)
    }

  s.setPhase('complete')
  s.setIsRunning(false)
  s.setActiveTab('stream')
}

function buildReportHTML(
  docs: ScoredDoc[], avg: string, isHybrid: boolean,
  docNames: string[], template: 'full' | 'briefing' | 'table'
): string {

  // ── SHARED FRAGMENTS ────────────────────────────────────────
  const complianceTable = `
<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">Compliance Comparison</div>
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead><tr style="background:var(--surface2)">
      ${['Factor','HubSpot','Salesforce','Pipedrive','Monday'].map(h=>`<th style="padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border2)">${h}</th>`).join('')}
    </tr></thead>
    <tbody>
      <tr><td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">SOC 2 Type II</td>${['✓','✓','✓','✓'].map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">${v}</td>`).join('')}</tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">GDPR</td>${['✓','✓','✓','✓'].map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">${v}</td>`).join('')}</tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">SEC Disclosure</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">✓</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">✓</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--red)">✗</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--red)">✗</td>
      </tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">AI Disclosure</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">✓</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--green)">✓</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--red)">✗</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--red)">✗</td>
      </tr>
      <tr><td style="padding:6px 8px;color:var(--text2)">Pricing Transparency</td>
        <td style="padding:6px 8px;color:var(--green)">✓</td>
        <td style="padding:6px 8px;color:var(--yellow)">~</td>
        <td style="padding:6px 8px;color:var(--green)">✓</td>
        <td style="padding:6px 8px;color:var(--green)">✓</td>
      </tr>
    </tbody>
  </table>
</div>`

  const internalFindings = isHybrid ? `
<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">
    Internal Audit Findings <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(157,127,240,.1);color:var(--purple);margin-left:4px">RAG</span>
  </div>
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="padding:5px 9px;border-radius:5px;background:rgba(31,207,114,.04);border:1px solid rgba(31,207,114,.14);color:var(--green);font-size:11px">✅ Q3 Compliance Policy aligns with SEC Rule 10b-5 — no critical gaps</div>
    <div style="padding:5px 9px;border-radius:5px;background:rgba(31,207,114,.04);border:1px solid rgba(31,207,114,.14);color:var(--green);font-size:11px">✅ Audit Report 2024 flagged 2 vendor risk items — both resolved in Q4</div>
    <div style="padding:5px 9px;border-radius:5px;background:rgba(240,192,64,.04);border:1px solid rgba(240,192,64,.14);color:var(--yellow);font-size:11px">⚠️ Data retention clause predates 2025 SEC guidance — update recommended</div>
  </div>
</div>` : ''

  const recommendation = `
<div>
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">Recommendation</div>
  <div style="padding:9px 11px;border-radius:6px;background:rgba(91,127,255,.05);border:1px solid rgba(91,127,255,.18);font-size:11px;color:var(--text2);line-height:1.6">
    <strong style="color:var(--accent)">Immediate:</strong> Update internal data retention clause to align with April 2025 SEC guidance.<br>
    <strong style="color:var(--accent)">Competitive:</strong> Salesforce is widening compliance moat — monitor Einstein AI governance.<br>
    <strong style="color:var(--accent)">Watch:</strong> Pipedrive and Monday CRM lack SEC disclosure pages — sales opportunity.
  </div>
</div>`

  // ── TABLE ONLY ───────────────────────────────────────────────
  if (template === 'table') {
    return `
${complianceTable}
${internalFindings}
<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">Pricing Snapshot</div>
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead><tr style="background:var(--surface2)">
      ${['CRM','Starter','Pro','Enterprise'].map(h=>`<th style="padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border2)">${h}</th>`).join('')}
    </tr></thead>
    <tbody>
      <tr>${['HubSpot','$20/mo','$90/mo','Custom'].map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${v}</td>`).join('')}</tr>
      <tr>${['Salesforce','$25/mo','$80/mo','Custom'].map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${v}</td>`).join('')}</tr>
      <tr>${['Pipedrive','$14/mo','$49/mo','$99/mo'].map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${v}</td>`).join('')}</tr>
      <tr>${['Monday CRM','$12/mo','$17/mo','Custom'].map(v=>`<td style="padding:6px 8px;color:var(--text2)">${v}</td>`).join('')}</tr>
    </tbody>
  </table>
</div>
${recommendation}`.trim()
  }

  // ── EXECUTIVE BRIEFING ───────────────────────────────────────
  if (template === 'briefing') {
    return `
<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid var(--border)">Key Findings</div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${[
      { color:'var(--green)',  text:'HubSpot and Salesforce are fully SEC-compliant and have published AI disclosure frameworks.' },
      { color:'var(--red)',    text:'Pipedrive and Monday CRM lack formal SEC disclosure pages — regulatory risk for enterprise buyers.' },
      { color:'var(--yellow)', text:'Salesforce Einstein AI governance white paper (May 2025) sets new enterprise compliance benchmark.' },
      { color:'var(--accent)', text:'Internal data retention clause predates 2025 SEC guidance — update recommended this quarter.' },
      ...(isHybrid ? [{ color:'var(--purple)', text:'Internal audit confirms Q3 policy aligns with SEC Rule 10b-5 — no critical gaps found.' }] : []),
    ].map(f => `<div style="display:flex;gap:9px;padding:7px 10px;border-radius:6px;background:${f.color}08;border:1px solid ${f.color}22;font-size:11px;color:var(--text2);line-height:1.5">
      <span style="color:${f.color};flex-shrink:0;margin-top:1px">●</span>
      ${f.text}
    </div>`).join('')}
  </div>
</div>

<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Actions Required</div>
  <div style="display:flex;flex-direction:column;gap:4px">
    <div style="padding:5px 9px;border-radius:5px;background:rgba(255,79,79,.04);border:1px solid rgba(255,79,79,.14);font-size:11px;color:var(--text2)">
      🔴 <strong style="color:var(--red)">High:</strong> Update data retention clause to 2025 SEC standards
    </div>
    <div style="padding:5px 9px;border-radius:5px;background:rgba(240,192,64,.04);border:1px solid rgba(240,192,64,.14);font-size:11px;color:var(--text2)">
      🟡 <strong style="color:var(--yellow)">Medium:</strong> Monitor Salesforce Einstein governance releases quarterly
    </div>
    <div style="padding:5px 9px;border-radius:5px;background:rgba(91,127,255,.04);border:1px solid rgba(91,127,255,.14);font-size:11px;color:var(--text2)">
      🔵 <strong style="color:var(--accent)">Opportunity:</strong> Pipedrive/Monday compliance gaps = sales advantage for compliant competitors
    </div>
  </div>
</div>

${recommendation}`.trim()
  }

  // ── FULL ANALYSIS (default) ──────────────────────────────────
  return `
<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">Executive Summary</div>
  <p style="font-size:12px;line-height:1.7;color:var(--text2)">
    Cross-referencing ${isHybrid ? 'internal compliance docs with ' : ''}2025 SEC guidelines reveals partial alignment gaps.
    HubSpot and Salesforce maintain strong official disclosures.
    Pipedrive and Monday CRM have newer but less detailed public compliance postures.
  </p>
</div>

${internalFindings}
${complianceTable}

<div style="margin-bottom:14px">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">🚨 Trend Alerts</div>
  <div style="padding:7px 10px;border-radius:6px;background:rgba(240,192,64,.04);border:1px solid rgba(240,192,64,.14);margin-bottom:5px;font-size:11px;color:var(--text2)">
    📋 <strong style="color:var(--yellow)">SEC updated AI disclosure rules</strong> (April 2025) — companies using AI in financial decisions must now disclose. HubSpot and Salesforce already compliant.
  </div>
  <div style="padding:7px 10px;border-radius:6px;background:rgba(240,192,64,.04);border:1px solid rgba(240,192,64,.14);font-size:11px;color:var(--text2)">
    🔒 <strong style="color:var(--yellow)">Salesforce Einstein</strong> published dedicated AI governance white paper (May 2025) — sets new bar for enterprise compliance.
  </div>
</div>

${recommendation}`.trim()
}