'use client'
import { useState } from 'react'
import { useAgentStore } from '@/store/agentStore'

export default function HitlCard() {
  const hitlData   = useAgentStore((s) => s.hitlData)
  const setHitlData= useAgentStore((s) => s.setHitlData)
  const [approved, setApproved] = useState(false)
  const [editing,  setEditing]  = useState(false)

  if (!hitlData) return null

  const allQueries = [...hitlData.webQueries, ...hitlData.internalQueries]
  const isHybrid   = hitlData.internalQueries.length > 0

  function handleApprove() {
    setApproved(true)
    // Signal approval back — demoRunner polls for this via store
    useAgentStore.getState().setHitlData(null)
  }

  if (approved) {
    return (
      <div className="fade-in" style={{
        borderRadius:9, border:'1px solid rgba(31,207,114,.3)',
        background:'var(--surface2)', padding:13, marginBottom:9,
      }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>
          ✅ Approved — Researcher now running…
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{
      borderRadius:9, border:'1px solid rgba(157,127,240,.3)',
      background:'var(--surface2)', padding:13, marginBottom:9,
    }}>
      {/* Header */}
      <div style={{ fontSize:12, fontWeight:700, color:'var(--purple)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
        ⏸ Human-in-the-Loop Checkpoint
      </div>

      <div style={{ fontSize:11, color:'var(--text2)', marginBottom:10, lineHeight:1.5 }}>
        Planner generated queries for{' '}
        <strong style={{ color:'var(--text)' }}>{isHybrid ? 'web + internal RAG' : 'web'}</strong>{' '}
        search. Review before spending API credits.
      </div>

      {/* Query list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
        {allQueries.map((q, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:7,
            background:'var(--bg)', border:'1px solid var(--border2)',
            borderRadius:5, padding:'6px 9px',
            fontSize:11, fontFamily:'JetBrains Mono, monospace', color:'var(--text2)',
          }}>
            <span style={{ fontSize:9, color:'var(--text3)', width:12, textAlign:'right', flexShrink:0 }}>
              {i + 1}
            </span>
            {editing ? (
              <input
                defaultValue={q}
                style={{
                  flex:1, background:'transparent', border:'none', outline:'none',
                  color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:11,
                }}
              />
            ) : (
              <span style={{ flex:1 }}>{q}</span>
            )}
            {/* Internal badge */}
            {i >= hitlData.webQueries.length && (
              <span style={{
                fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3,
                background:'rgba(157,127,240,.1)', color:'var(--purple)', flexShrink:0,
              }}>
                RAG
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display:'flex', gap:7 }}>
        <button
          onClick={handleApprove}
          style={{
            flex:1, padding:7, borderRadius:6,
            background:'rgba(31,207,114,.12)', color:'var(--green)',
            border:'1px solid rgba(31,207,114,.25)',
            fontSize:11, fontWeight:700, cursor:'pointer',
          }}
        >
          ✓ Approve &amp; Run
        </button>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            flex:1, padding:7, borderRadius:6,
            background:'var(--bg)', color:'var(--text2)',
            border:'1px solid var(--border2)',
            fontSize:11, fontWeight:700, cursor:'pointer',
          }}
        >
          {editing ? '💾 Save Edits' : '✎ Edit Queries'}
        </button>
      </div>
    </div>
  )
}