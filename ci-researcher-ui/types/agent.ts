export type NodeId     = 'planner' | 'researcher' | 'validator' | 'analyst' | 'report' | 'notifier'
export type NodeStatus = 'idle' | 'active' | 'done' | 'warn' | 'notify'
export type RunPhase   = 'idle' | 'running' | 'hitl' | 'complete' | 'error'
export type SourceMode = 'web' | 'internal' | 'hybrid'
export type SourceType = 'official' | 'internal_doc' | 'review_site' | 'reddit' | 'blog' | 'news' | 'community'
export type AvatarVariant = 'planner' | 'researcher' | 'validator' | 'analyst' | 'report' | 'notifier' | 'system'
export type StatusChip    = 'running' | 'complete' | 'gap' | 'sending' | 'failed'

export interface ScoredDoc {
  url:         string
  type:        SourceType
  credibility: number
  recency:     number
  snippet?:    string
  date?:       string
}

export interface UploadedFile {
  name: string
  size: string
  id:   string
}

export interface ThoughtCardData {
  id:        string
  avatar:    AvatarVariant
  label:     string
  status:    StatusChip
  body:      string        // HTML string
  timestamp: string
}

export interface HitlData {
  webQueries:      string[]
  internalQueries: string[]
}

export interface DeliveryConfig {
  slackEnabled: boolean
  slackTarget:  string
  emailEnabled: boolean
  emailTarget:  string
}

export interface DeliveryResult {
  channel:    'slack' | 'email'
  success:    boolean
  statusCode: number
  sentAt?:    string
}

export type NodeStates = Record<NodeId, NodeStatus>
export type NodeBadges = Record<NodeId, string>

export interface AgentStateSnapshot {
  topic:           string
  queries:         string[] | string
  docs:            ScoredDoc[] | string
  gaps:            string[]
  iteration_count: number
  report:          string | null
  delivery_status: string
}

export interface ProgressState {
  label:   string
  percent: number
  visible: boolean
}