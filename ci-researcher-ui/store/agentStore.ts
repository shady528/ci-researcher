import { create } from 'zustand'
import type {
  RunPhase, NodeStates, NodeBadges, NodeId, NodeStatus,
  ThoughtCardData, HitlData, ScoredDoc, DeliveryResult,
  AgentStateSnapshot, ProgressState, SourceMode, UploadedFile, DeliveryConfig,
} from '@/types/agent'

const defaultNodeStates: NodeStates = {
  planner: 'idle', researcher: 'idle', validator: 'idle',
  analyst: 'idle', report: 'idle',    notifier: 'idle',
}
const defaultNodeBadges: NodeBadges = {
  planner: '', researcher: '', validator: '',
  analyst: '', report: '',    notifier: '',
}

export type ReportTemplate = 'full' | 'briefing' | 'table'

export type ModelId =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'claude-3-5-sonnet'
  | 'claude-3-haiku'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'

export type EmbeddingModelId =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'

export type ResearchDepth = 'quick' | 'standard' | 'deep'

export interface ModelConfig {
  planner:     ModelId
  researcher:  ModelId
  validator:   ModelId
  analyst:     ModelId
  writer:      ModelId
  embedding:   EmbeddingModelId
  depth:       ResearchDepth
  temperatures: {
    planner:    number
    researcher: number
    analyst:    number
    writer:     number
  }
}

interface AgentStore {
  theme:    'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void

  phase:    RunPhase
  threadId: string | null

  nodeStates:   NodeStates
  nodeBadges:   NodeBadges
  showCondEdge: boolean
  iterText:     string

  thoughts:  ThoughtCardData[]
  hitlData:  HitlData | null

  progress: ProgressState

  activeTab:       'stream' | 'state' | 'cred' | 'delivery'
  stateSnapshot:   AgentStateSnapshot | null
  scoredDocs:      ScoredDoc[]
  reportMd:        string
  deliveryResults: DeliveryResult[]
  diffMode:        boolean
  diffReportIds:   [number, number] | null

  leftCollapsed: boolean
  setLeftCollapsed: (v: boolean) => void

  webDocs:   number
  intDocs:   number
  avgCred:   string
  gapStat:   string
  elapsed:   string
  isRunning: boolean

  topic:         string
  sourceMode:    SourceMode
  uploadedFiles: UploadedFile[]
  delivery:      DeliveryConfig

  modelConfig:    ModelConfig
  setModelConfig: (c: Partial<ModelConfig>) => void
  setTemperature: (role: keyof ModelConfig['temperatures'], val: number) => void

  reportTemplate:    ReportTemplate
  setReportTemplate: (t: ReportTemplate) => void

  focus:         string
  domainAllow:   string[]
  domainBlock:   string[]
  setFocus:      (f: string) => void
  setDomainAllow: (d: string[]) => void
  setDomainBlock: (d: string[]) => void

  setPhase:           (p: RunPhase) => void
  setNodeStatus:      (id: NodeId, status: NodeStatus) => void
  setNodeBadge:       (id: NodeId, text: string) => void
  addThought:         (t: ThoughtCardData) => void
  setHitlData:        (d: HitlData | null) => void
  setProgress:        (label: string, percent: number, visible?: boolean) => void
  setActiveTab:       (tab: 'stream' | 'state' | 'cred' | 'delivery') => void
  setStateSnapshot:   (s: AgentStateSnapshot) => void
  setScoredDocs:      (docs: ScoredDoc[]) => void
  setReportMd:        (md: string) => void
  setDeliveryResults: (r: DeliveryResult[]) => void
  setDiffMode:        (v: boolean) => void
  setDiffReportIds:   (ids: [number, number] | null) => void
  setShowCondEdge:    (v: boolean) => void
  setIterText:        (t: string) => void
  setWebDocs:         (n: number) => void
  setIntDocs:         (n: number) => void
  setAvgCred:         (s: string) => void
  setGapStat:         (s: string) => void
  setElapsed:         (s: string) => void
  setIsRunning:       (v: boolean) => void
  setTopic:           (t: string) => void
  setSourceMode:      (m: SourceMode) => void
  setUploadedFiles:   (f: UploadedFile[]) => void
  setDelivery:        (d: Partial<DeliveryConfig>) => void
  reset:              () => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  theme:    'dark',
  setTheme: (t) => set({ theme: t }),

  phase:        'idle',
  threadId:     null,
  nodeStates:   { ...defaultNodeStates },
  nodeBadges:   { ...defaultNodeBadges },
  showCondEdge: false,
  iterText:     'Iteration 0 / 3 max',
  thoughts:     [],
  hitlData:     null,
  progress:     { label: '', percent: 0, visible: false },

  activeTab:       'stream',
  stateSnapshot:   null,
  scoredDocs:      [],
  reportMd:        '',
  deliveryResults: [],
  diffMode:        false,
  diffReportIds:   null,

  leftCollapsed:    false,
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),

  webDocs:   0,
  intDocs:   0,
  avgCred:   '—',
  gapStat:   '0/0',
  elapsed:   '—',
  isRunning: false,

  topic:         '',
  sourceMode:    'web',
  uploadedFiles: [],
  delivery: {
    slackEnabled: false,
    slackTarget:  '',
    emailEnabled: true,
    emailTarget:  'team@company.com',
  },

  focus:       '',
  domainAllow: [],
  domainBlock: [],

  reportTemplate: 'full',

  modelConfig: {
    planner:    'gpt-4o-mini',
    researcher: 'gpt-4o-mini',
    validator:  'gpt-4o-mini',
    analyst:    'gpt-4o',
    writer:     'gpt-4o',
    embedding:  'text-embedding-3-small',
    depth:      'standard',
    temperatures: {
      planner:    0.3,
      researcher: 0.1,
      analyst:    0.4,
      writer:     0.7,
    },
  },

  setPhase:           (p)         => set({ phase: p }),
  setNodeStatus:      (id, status) => set((s) => ({ nodeStates: { ...s.nodeStates, [id]: status } })),
  setNodeBadge:       (id, text)   => set((s) => ({ nodeBadges: { ...s.nodeBadges, [id]: text } })),
  addThought:         (t)          => set((s) => ({ thoughts: [...s.thoughts, t] })),
  setHitlData:        (d)          => set({ hitlData: d }),
  setProgress:        (label, percent, visible = true) => set({ progress: { label, percent, visible } }),
  setActiveTab:       (tab)        => set({ activeTab: tab }),
  setStateSnapshot:   (s)          => set({ stateSnapshot: s }),
  setScoredDocs:      (docs)       => set({ scoredDocs: docs }),
  setReportMd:        (md)         => set({ reportMd: md }),
  setDeliveryResults: (r)          => set({ deliveryResults: r }),
  setDiffMode:        (v)          => set({ diffMode: v }),
  setDiffReportIds:   (ids)        => set({ diffReportIds: ids }),
  setShowCondEdge:    (v)          => set({ showCondEdge: v }),
  setIterText:        (t)          => set({ iterText: t }),
  setWebDocs:         (n)          => set({ webDocs: n }),
  setIntDocs:         (n)          => set({ intDocs: n }),
  setAvgCred:         (s)          => set({ avgCred: s }),
  setGapStat:         (s)          => set({ gapStat: s }),
  setElapsed:         (s)          => set({ elapsed: s }),
  setIsRunning:       (v)          => set({ isRunning: v }),
  setTopic:           (t)          => set({ topic: t }),
  setSourceMode:      (m)          => set({ sourceMode: m }),
  setUploadedFiles:   (f)          => set({ uploadedFiles: f }),
  setDelivery:        (d)          => set((s) => ({ delivery: { ...s.delivery, ...d } })),

  setModelConfig: (c) => set((s) => ({ modelConfig: { ...s.modelConfig, ...c } })),
  setTemperature: (role, val) => set((s) => ({
    modelConfig: {
      ...s.modelConfig,
      temperatures: { ...s.modelConfig.temperatures, [role]: val },
    },
  })),

  setReportTemplate: (t) => set({ reportTemplate: t }),

  setFocus:       (f) => set({ focus: f }),
  setDomainAllow: (d) => set({ domainAllow: d }),
  setDomainBlock: (d) => set({ domainBlock: d }),

  reset: () => set({
    phase:           'idle',
    nodeStates:      { ...defaultNodeStates },
    nodeBadges:      { ...defaultNodeBadges },
    showCondEdge:    false,
    iterText:        'Iteration 0 / 3 max',
    thoughts:        [],
    hitlData:        null,
    progress:        { label: '', percent: 0, visible: false },
    activeTab:       'stream',
    stateSnapshot:   null,
    scoredDocs:      [],
    reportMd:        '',
    deliveryResults: [],
    diffMode:        false,
    diffReportIds:   null,
    webDocs:         0,
    intDocs:         0,
    avgCred:         '—',
    gapStat:         '0/0',
    elapsed:         '—',
    isRunning:       false,
    focus:           '',
    domainAllow:     [],
    domainBlock:     [],
    reportTemplate: 'full',
  }),
}))
