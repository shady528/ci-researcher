'use client'
import { useAgentStore } from '@/store/agentStore'
import ThoughtCard from './ThoughtCard'
import { useEffect, useRef } from 'react'

export default function ThoughtStream() {
  const thoughts  = useAgentStore((s) => s.thoughts)
  const phase     = useAgentStore((s) => s.phase)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thoughts.length])

  const isEmpty = thoughts.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {isEmpty ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 200, gap: 8,
          color: 'var(--text3)', textAlign: 'center', padding: 20,
        }}>
          <div style={{ fontSize: 28, opacity: .35 }}>💭</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            Agent thoughts appear here in real-time<br />as each node runs.
          </div>
        </div>
      ) : (
        <>
          {thoughts.map((card) => (
            <ThoughtCard key={card.id} card={card} />
          ))}

          {/* Typing indicator while running */}
          {phase === 'running' && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '6px 2px' }}>
              {[0, 200, 400].map((delay) => (
                <div key={delay} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `typingPulse 1.2s ${delay}ms infinite`,
                }} />
              ))}
            </div>
          )}
        </>
      )}

      <div ref={bottomRef} />
    </div>
  )
}