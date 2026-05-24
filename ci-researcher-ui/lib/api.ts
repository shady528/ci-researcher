const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

// ── Request / Response types ─────────────────────────────────────────

export interface RunRequest {
  topic:           string
  source_mode:     'web' | 'internal' | 'hybrid'
  file_ids?:       string[]
  session_id?:     string
  model_config?: {
    planner:      string
    researcher:   string
    validator:    string
    analyst:      string
    writer:       string
    embedding:    string
    depth:        string
    temperatures: Record<string, number>
  }
  focus?:           string
  domain_allow?:    string[]
  domain_block?:    string[]
  report_template?: string
  delivery?: {
    slack_enabled: boolean
    slack_target:  string
    email_enabled: boolean
    email_target:  string
  }
}

export interface RunResponse {
  thread_id:  string
  status:     string
  stream_url: string
}

export interface HitlApproveRequest {
  queries:     string[]
  rag_queries: string[]
}

export interface StatusResponse {
  thread_id:   string
  phase:       string
  is_complete: boolean
  elapsed_s:   number
  error:       string | null
}

// ── API client ───────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

export const startRun       = (req: RunRequest) =>
  post<RunResponse>('/api/run', req)

export const uploadFile = async (file: File, sessionId: string): Promise<{
  session_id: string; filename: string; chunks: number; pages: number
}> => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `${BACKEND}/api/upload?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'POST', body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Upload failed')
  }
  return res.json()
}

export const deleteSession = async (sessionId: string): Promise<void> => {
  await fetch(`${BACKEND}/api/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

export const approveHitl    = (threadId: string, req: HitlApproveRequest) =>
  post<{ ok: boolean }>(`/api/hitl/${threadId}/approve`, req)

export const getRunStatus   = (threadId: string) =>
  get<StatusResponse>(`/api/run/${threadId}/status`)

export const openSSEStream  = (threadId: string) =>
  new EventSource(`${BACKEND}/api/stream/${threadId}`)
