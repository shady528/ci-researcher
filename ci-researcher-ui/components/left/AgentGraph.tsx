'use client'
import { useAgentStore } from '@/store/agentStore'
import type { NodeId, NodeStatus } from '@/types/agent'

const NODES: { id: NodeId; icon: string; label: string; sub: string; hasLine: boolean }[] = [
  { id:'planner',    icon:'📋', label:'Planner',         sub:'Topic → queries',       hasLine:true  },
  { id:'researcher', icon:'🔍', label:'Researcher',      sub:'Web + Internal RAG',    hasLine:true  },
  { id:'validator',  icon:'🛡', label:'Validator',       sub:'Credibility scoring',   hasLine:true  },
  { id:'analyst',    icon:'🧠', label:'Analyst',         sub:'Reflect · gap check',   hasLine:true  },
  { id:'report',     icon:'📊', label:'Report Generator',sub:'Formats final output',  hasLine:true  },
  { id:'notifier',   icon:'🚀', label:'Notifier',        sub:'Slack · Email delivery',hasLine:false },
]

const STATUS_COLORS: Record<NodeStatus, { border:string; bg:string; text:string; line:string }> = {
  idle:   { border:'var(--border2)',  bg:'var(--surface2)',              text:'var(--text2)',   line:'var(--border2)' },
  active: { border:'var(--accent)',   bg:'rgba(91,127,255,.14)',          text:'var(--accent)',  line:'var(--accent)'  },
  done:   { border:'var(--green)',    bg:'rgba(31,207,114,.1)',           text:'var(--green)',   line:'var(--green)'   },
  warn:   { border:'var(--yellow)',   bg:'rgba(240,192,64,.1)',           text:'var(--yellow)',  line:'var(--yellow)'  },
  notify: { border:'var(--orange)',   bg:'rgba(255,140,66,.1)',           text:'var(--orange)',  line:'var(--orange)'  },
}

const BADGE_COLORS: Record<string, { bg:string; color:string }> = {
  done:  { bg:'rgba(31,207,114,.12)',  color:'var(--green)'  },
  loop:  { bg:'rgba(240,192,64,.1)',   color:'var(--yellow)' },
  ntfy:  { bg:'rgba(255,140,66,.1)',   color:'var(--orange)' },
}

export default function AgentGraph() {
  const nodeStates  = useAgentStore((s) => s.nodeStates)
  const nodeBadges  = useAgentStore((s) => s.nodeBadges)
  const showCondEdge= useAgentStore((s) => s.showCondEdge)
  const iterText    = useAgentStore((s) => s.iterText)

  return (
    <div>
      <div style={{
        fontSize:10, fontWeight:700, color:'var(--text3)',
        textTransform:'uppercase', letterSpacing:'.7px', marginBottom:11,
      }}>
        Agent Graph
      </div>

      {NODES.map((node, i) => {
        const status  = nodeStates[node.id]
        const badge   = nodeBadges[node.id]
        const colors  = STATUS_COLORS[status]
        const isActive = status === 'active'

        // Insert conditional edge between analyst (index 3) and report (index 4)
        const showEdgeAfter = i === 3 && showCondEdge

        return (
          <div key={node.id}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:3 }}>
              {/* Connector column */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:36, flexShrink:0 }}>
                {/* Node dot */}
                <div style={{
                  width:30, height:30, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, flexShrink:0,
                  border:`2px solid ${colors.border}`,
                  background: colors.bg,
                  transition:'all .3s',
                  animation: isActive ? 'glow 1.4s ease-in-out infinite' : 'none',
                }}>
                  {node.icon}
                </div>

                {/* Connector line */}
                {node.hasLine && (
                  <div style={{
                    width:2, height:16,
                    background: status === 'done' ? colors.line
                              : status === 'active' ? colors.line
                              : 'var(--border2)',
                    margin:'2px 0', transition:'background .3s',
                  }} />
                )}
              </div>

              {/* Node info */}
              <div style={{ flex:1, paddingLeft:9 }}>
                <div style={{ fontSize:12, fontWeight:600, color:colors.text, transition:'color .3s' }}>
                  {node.label}
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>
                  {node.sub}
                </div>
              </div>

              {/* Badge */}
              {badge && (
                <div style={{
                  fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4,
                  marginLeft:'auto', flexShrink:0,
                  ...(badge.includes('gap') || badge.includes('gaps')
                    ? BADGE_COLORS.loop
                    : badge.includes('Sent')
                    ? BADGE_COLORS.ntfy
                    : BADGE_COLORS.done),
                }}>
                  {badge}
                </div>
              )}
            </div>

            {/* Conditional edge */}
            {showEdgeAfter && (
              <div style={{
                display:'flex', alignItems:'center', gap:5,
                margin:'1px 0 1px 36px', padding:'4px 9px',
                background:'rgba(240,192,64,.05)',
                border:'1px solid rgba(240,192,64,.15)',
                borderRadius:5, fontSize:10, color:'var(--yellow)',
              }}>
                ⚡ Gap detected → looping back to Researcher
              </div>
            )}
          </div>
        )
      })}

      {/* Iteration pill */}
      <div style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'6px 10px', borderRadius:6,
        background:'rgba(157,127,240,.07)', border:'1px solid rgba(157,127,240,.2)',
        marginTop:10, fontSize:11, color:'var(--purple)',
      }}>
        🔁 {iterText}
      </div>
    </div>
  )
}