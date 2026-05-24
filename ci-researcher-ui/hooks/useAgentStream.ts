import { useCallback, useRef } from 'react'
import { useAgentStore }  from '@/store/agentStore'
import { startRun, approveHitl, openSSEStream, deleteSession } from '@/lib/api'
import type { ThoughtCardData, ScoredDoc } from '@/types/agent'

let _cardId = 0
function card(
  avatar:  ThoughtCardData['avatar'],
  label:   string,
  status:  ThoughtCardData['status'],
  body:    string,
): ThoughtCardData {
  return {
    id:        String(++_cardId),
    avatar, label, status, body,
    timestamp: new Date().toTimeString().slice(0, 8),
  }
}

const NODE_AVATAR: Record<string, ThoughtCardData['avatar']> = {
  planner:         'planner',
  researcher:      'researcher',
  validator:       'validator',
  analyst:         'analyst',
  generate_report: 'report',
  notifier:        'notifier',
}

function toStoreNode(node: string) {
  return (node === 'generate_report' ? 'report' : node) as any
}

export function useAgentStream() {
  const esRef = useRef<EventSource | null>(null)

  const cleanup = useCallback(async () => {
    const sid = useAgentStore.getState().sessionId
    if (sid) {
      try {
        await deleteSession(sid)
        console.log('[cleanup] Session embeddings deleted:', sid)
      } catch (err) {
        console.warn('[cleanup] Failed to delete session:', err)
      }
    }
  }, [])

  const stop = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    void cleanup()
  }, [cleanup])

  const run = useCallback(async () => {
    // Always read fresh state inside callbacks
    const s = useAgentStore.getState()
    if (s.isRunning) return

    s.setPhase('running')
    s.setIsRunning(true)
    s.setProgress('Starting run…', 2)

    let threadId: string
    try {
      const res = await startRun({
        topic:           s.topic,
        source_mode:     s.sourceMode,
        file_ids:        s.uploadedFiles.map((f) => f.id),
        session_id:      s.sessionId ?? '',
        focus:           s.focus || undefined,
        domain_allow:    s.domainAllow,
        domain_block:    s.domainBlock,
        report_template: s.reportTemplate,
        model_config: {
          planner:      s.modelConfig.planner,
          researcher:   s.modelConfig.researcher,
          validator:    s.modelConfig.validator,
          analyst:      s.modelConfig.analyst,
          writer:       s.modelConfig.writer,
          embedding:    s.modelConfig.embedding,
          depth:        s.modelConfig.depth,
          temperatures: s.modelConfig.temperatures,
        },
        delivery: {
          slack_enabled: s.delivery.slackEnabled,
          slack_target:  s.delivery.slackTarget,
          email_enabled: s.delivery.emailEnabled,
          email_target:  s.delivery.emailTarget,
        },
      })
      threadId = res.thread_id
      useAgentStore.getState().setThreadId(threadId)
      useAgentStore.getState().setProgress('Building your research plan…', 7)
    } catch (err) {
      console.error('[run] Failed to start:', err)
      useAgentStore.getState().setPhase('idle')
      useAgentStore.getState().setIsRunning(false)
      return
    }

    // ── Open SSE ──────────────────────────────────────────────────
    const es = openSSEStream(threadId)
    esRef.current = es

    es.onmessage = (e: MessageEvent) => {
      // Always get fresh store reference inside handler
      const store = useAgentStore.getState()

      let msg: { event: string; data: any }
      try {
        msg = JSON.parse(e.data)
      } catch {
        console.warn('[SSE] Failed to parse:', e.data)
        return
      }

      const { event, data } = msg
      console.debug('[SSE]', event, data)

      switch (event) {

        case 'connected':
          console.log('[SSE] Connected, thread:', data.thread_id)
          break

        case 'node_start': {
          const av = NODE_AVATAR[data.node] ?? 'system'
          store.setNodeStatus(toStoreNode(data.node), 'active')
          store.setProgress(data.message, data.percent ?? 10)
          store.addThought(card(av, data.label, 'running', data.message))
          break
        }

        case 'node_complete': {
          const av = NODE_AVATAR[data.node] ?? 'system'
          store.setNodeStatus(toStoreNode(data.node), 'done')
          if (data.badge) store.setNodeBadge(toStoreNode(data.node), data.badge)
          store.addThought(card(av, data.label, 'complete', data.body ?? `${data.label} complete.`))
          break
        }

        case 'hitl_pause': {
          store.setPhase('hitl')
          store.setHitlData({
            webQueries:      data.queries      ?? [],
            internalQueries: data.rag_queries  ?? [],
          })
          store.setProgress('Waiting for your approval before searching…', 14)
          break
        }

        case 'scored_docs': {
          const docs: ScoredDoc[] = (data.docs ?? []).map((d: any) => ({
            url:         d.url,
            type:        d.type,
            credibility: d.credibility,
            recency:     d.recency ?? 0.8,
          }))
          store.setScoredDocs(docs)
          store.setAvgCred(String(parseFloat(data.avg_credibility).toFixed(2)))
          store.setWebDocs(docs.filter((d) => d.type !== 'internal_doc').length)
          store.setIntDocs(docs.filter((d) => d.type === 'internal_doc').length)
          break
        }

        case 'report_ready': {
          store.setReportMd(data.report_md)
          store.setNodeStatus('report', 'done')
          store.setProgress('Your report is ready', 100)

          // Persist to history
          const st        = useAgentStore.getState()
          const credNum   = parseFloat(st.avgCred)
          const credLabel = credNum >= 0.75 ? 'Strong' : credNum >= 0.5 ? 'Moderate' : 'Limited'
          fetch('/api/reports', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic:        st.topic,
              report_html:  data.report_html,
              cred_label:   credLabel,
              source_count: st.webDocs + st.intDocs,
              elapsed:      st.elapsed,
            }),
          }).catch(console.warn)
          break
        }

        case 'delivery_done': {
          const results = (data.results ?? []).map((r: any) => ({
            channel:    r.channel as 'slack' | 'email',
            success:    r.success,
            statusCode: r.status_code,
            sentAt:     new Date().toTimeString().slice(0, 8),
          }))
          store.setDeliveryResults(results)
          store.setNodeStatus('notifier', 'done')
          store.setNodeBadge('notifier', 'Sent ✓')
          break
        }

        case 'run_complete': {
          store.setElapsed(`${data.elapsed}s`)
          store.setPhase('complete')
          store.setIsRunning(false)
          store.setActiveTab('stream')
          stop()
          break
        }

        case 'error': {
          console.error('[SSE] Agent error:', data.message)
          store.addThought(card('system', 'Error', 'failed', data.message))
          store.setPhase('idle')
          store.setIsRunning(false)
          stop()
          break
        }

        case 'done':
          stop()
          break
      }
    }

    es.onerror = (e) => {
      console.error('[SSE] Connection error', e)
      es.close()
      const st = useAgentStore.getState()
      if (!st.reportMd) {
        st.setPhase('idle')
        st.setIsRunning(false)
      }
    }
  }, [stop])

  // ── Approve HITL ─────────────────────────────────────────────────
  const approve = useCallback(async (queries: string[], ragQueries: string[]) => {
    const threadId = useAgentStore.getState().threadId
    if (!threadId) {
      console.error('[approve] No threadId in store')
      return
    }
    try {
      await approveHitl(threadId, { queries, rag_queries: ragQueries })
      const store = useAgentStore.getState()
      store.setPhase('running')
      store.setHitlData(null)
      store.setProgress('Searching the web and your documents…', 28)
    } catch (err) {
      console.error('[approve] HITL failed:', err)
    }
  }, [])

  return { run, approve, stop, cleanup }
}
