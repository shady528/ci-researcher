'use client'
import { useAgentStore } from '@/store/agentStore'

function highlight(json: string): string {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'color:var(--purple)'
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'color:var(--accent)' : 'color:var(--green)'
      } else if (/true|false/.test(match)) {
        cls = 'color:var(--orange)'
      } else if (/null/.test(match)) {
        cls = 'color:var(--red)'
      }
      return `<span style="${cls}">${match}</span>`
    })
}

export default function StateViewer() {
  const snap = useAgentStore((s) => s.stateSnapshot)

  if (!snap) {
    return (
      <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', marginTop:40 }}>
        <div style={{ fontSize:24, marginBottom:8, opacity:.3 }}>{ }</div>
        State snapshot appears here once the agent starts running.
      </div>
    )
  }

  const display = {
    topic:           snap.topic,
    queries:         snap.queries,
    docs_count:      Array.isArray(snap.docs) ? snap.docs.length : snap.docs,
    gaps:            snap.gaps,
    iteration_count: snap.iteration_count,
    report:          snap.report
      ? (typeof snap.report === 'string' && snap.report.length > 60
          ? snap.report.slice(0, 60) + '…'
          : snap.report)
      : null,
    delivery_status: snap.delivery_status,
  }

  const json = JSON.stringify(display, null, 2)

  return (
    <div>
      <div style={{
        fontSize:9, fontWeight:700, textTransform:'uppercase',
        letterSpacing:'.7px', color:'var(--text3)', marginBottom:9,
      }}>
        Global State — Live Snapshot
      </div>

      <div style={{
        background:'var(--bg)', border:'1px solid var(--border2)',
        borderRadius:7, padding:12, overflowX:'auto',
        fontFamily:'JetBrains Mono, monospace', fontSize:11, lineHeight:1.7,
      }}
        dangerouslySetInnerHTML={{ __html: highlight(json) }}
      />

      {/* Key stats */}
      {Array.isArray(snap.docs) && snap.docs.length > 0 && (
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          gap:7, marginTop:10,
        }}>
          {[
            { label:'Documents', value: String(snap.docs.length) },
            { label:'Iterations', value: String(snap.iteration_count) },
            { label:'Gaps', value: String(snap.gaps.length) },
            { label:'Delivery', value: snap.delivery_status },
          ].map((s) => (
            <div key={s.label} style={{
              background:'var(--surface2)', border:'1px solid var(--border)',
              borderRadius:6, padding:'7px 10px',
            }}>
              <div style={{ fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px' }}>
                {s.label}
              </div>
              <div style={{
                fontSize:13, fontWeight:700, color:'var(--accent)',
                fontFamily:'JetBrains Mono, monospace', marginTop:2,
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}