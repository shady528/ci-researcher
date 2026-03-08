'use client'
import { useAgentStore } from '@/store/agentStore'

export default function StatusBar() {
  const { webDocs, intDocs, avgCred, gapStat, elapsed, isRunning } = useAgentStore()

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding:'0 16px', height:26,
      background:'var(--surface)', borderTop:'1px solid var(--border)',
      fontSize:10, color:'var(--text3)', flexShrink:0,
    }}>
      {/* Status dot + text */}
      <span style={{ display:'flex', alignItems:'center', gap:5 }}>
        <span style={{
          width:5, height:5, borderRadius:'50%',
          background: isRunning ? 'var(--accent)' : 'var(--green)',
          animation: isRunning ? 'blink 1s infinite' : 'none',
          display:'inline-block',
        }} />
        {isRunning ? 'Running' : 'Ready'}
      </span>

      <Sep />
      <Stat label="Web docs"    value={String(webDocs)} />
      <Sep />
      <Stat label="Internal"    value={String(intDocs)} />
      <Sep />
      <Stat label="Avg cred"    value={avgCred} />
      <Sep />
      <Stat label="Gaps"        value={gapStat} />
      <Sep />
      <Stat label="Elapsed"     value={elapsed} />
    </div>
  )
}

function Sep() {
  return <span style={{ color:'var(--border2)' }}>|</span>
}

function Stat({ label, value }: { label:string; value:string }) {
  return (
    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
      {label}: <strong style={{ color:'var(--text2)' }}>{value}</strong>
    </span>
  )
}