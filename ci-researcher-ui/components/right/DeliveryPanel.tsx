'use client'
import { useAgentStore } from '@/store/agentStore'

export default function DeliveryPanel() {
  const results  = useAgentStore((s) => s.deliveryResults)
  const delivery = useAgentStore((s) => s.delivery)
  const phase    = useAgentStore((s) => s.phase)

  const slackRes = results.find((r) => r.channel === 'slack')
  const emailRes = results.find((r) => r.channel === 'email')

  return (
    <div>
      <div style={{
        fontSize:9, fontWeight:700, textTransform:'uppercase',
        letterSpacing:'.7px', color:'var(--text3)', marginBottom:11,
      }}>
        Delivery Channels
      </div>

      {/* Slack */}
      <ChannelCard
        icon="💬"
        label="Slack"
        target={delivery.slackTarget || 'Not configured'}
        enabled={delivery.slackEnabled}
        result={slackRes}
        phase={phase}
      />

      {/* Email */}
      <ChannelCard
        icon="📧"
        label="Email (SendGrid)"
        target={delivery.emailTarget || 'Not configured'}
        enabled={delivery.emailEnabled}
        result={emailRes}
        phase={phase}
      />

      {/* Summary */}
      {results.length > 0 && (
        <div style={{
          marginTop:12, padding:'8px 11px', borderRadius:7,
          background:'rgba(31,207,114,.05)', border:'1px solid rgba(31,207,114,.18)',
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', marginBottom:4 }}>
            ✅ Delivery Complete
          </div>
          <div style={{ fontSize:10, color:'var(--text2)' }}>
            {results.filter((r) => r.success).length}/{results.length} channels delivered successfully.
          </div>
          {results.map((r, i) => (
            <div key={i} style={{
              fontSize:10, color:'var(--text3)', marginTop:3,
              fontFamily:'JetBrains Mono, monospace',
            }}>
              {r.channel === 'slack' ? '💬' : '📧'} {r.channel} →{' '}
              <span style={{ color: r.success ? 'var(--green)' : 'var(--red)' }}>
                {r.statusCode} {r.success ? 'OK' : 'FAILED'}
              </span>
              {r.sentAt ? ` at ${r.sentAt}` : ''}
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && phase !== 'complete' && (
        <div style={{ color:'var(--text3)', fontSize:12, textAlign:'center', marginTop:30 }}>
          <div style={{ fontSize:24, marginBottom:8, opacity:.3 }}>📬</div>
          Delivery status appears after the run completes.
        </div>
      )}
    </div>
  )
}

function ChannelCard({ icon, label, target, enabled, result, phase }: {
  icon:string; label:string; target:string
  enabled:boolean; result: { success:boolean; statusCode:number; sentAt?:string } | undefined
  phase:string
}) {
  const statusColor = !enabled         ? 'var(--border2)'
                    : result?.success  ? 'var(--green)'
                    : phase === 'complete' && !result ? 'var(--text3)'
                    : phase === 'running' ? 'var(--accent)'
                    : 'var(--border2)'

  const statusLabel = !enabled              ? 'Off'
                    : result?.success       ? `Sent · ${result.statusCode}`
                    : phase === 'running'   ? 'Sending…'
                    : phase === 'complete'  ? 'Skipped'
                    : 'Pending'

  return (
    <div style={{
      padding:'10px 13px', borderRadius:8,
      background:'var(--surface2)', border:`1px solid var(--border)`,
      marginBottom:8,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:15 }}>{icon}</span>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{label}</div>
            <div style={{
              fontSize:10, color:'var(--text3)',
              fontFamily:'JetBrains Mono, monospace', marginTop:1,
            }}>
              {target}
            </div>
          </div>
        </div>

        <span style={{
          fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:4,
          background:`${statusColor}18`, color:statusColor,
          border:`1px solid ${statusColor}33`,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Slack preview when delivered */}
      {result?.success && icon === '💬' && (
        <div style={{
          marginTop:9, padding:'8px 10px', borderRadius:6,
          background:'var(--bg)', border:'1px solid var(--border2)',
          borderLeft:'3px solid #5b7fff', fontSize:10, color:'var(--text2)', lineHeight:1.5,
        }}>
          <div style={{ fontWeight:700, color:'var(--text)', marginBottom:3 }}>
            🔍 CI Researcher — Research Complete
          </div>
          <div>Report delivered with confidence score and full source breakdown.</div>
          <div style={{ marginTop:5, color:'var(--text3)' }}>
            via Incoming Webhook · {result.sentAt}
          </div>
        </div>
      )}
    </div>
  )
}