// ─────────────────────────────────────────────
// Hesed Translation — Central TypeScript Types
// ─────────────────────────────────────────────

export type UserRole = 'EDITOR' | 'REVISOR' | 'GERENTE'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  image?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Project ──────────────────────────────────

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'

export interface Project {
  id: string
  name: string
  description?: string | null
  sourceLang: string
  targetLang: string
  status: ProjectStatus
  deadline?: string | null
  managerId: string
  manager?: Pick<User, 'id' | 'name'>
  fileCount?: number
  wordCount?: number
  translationProgress?: number
  reviewProgress?: number
  createdAt: string
  updatedAt: string
}

// ─── File ─────────────────────────────────────

export type FileStatus =
  | 'READY'
  | 'TRANSLATING'
  | 'TRANSLATED'
  | 'REVIEWING'
  | 'DONE'
  | 'REJECTED'

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  originalName: string
  status: FileStatus
  sourceLang: string
  targetLang: string
  wordCount: number
  totalSegments: number
  translatedSegments: number
  reviewedSegments: number
  editorId?: string | null
  revisorId?: string | null
  editor?: Pick<User, 'id' | 'name' | 'email'> | null
  revisor?: Pick<User, 'id' | 'name' | 'email'> | null
  deadline?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Segment ──────────────────────────────────

export type SegmentStatus =
  | 'PENDING'
  | 'TRANSLATING'
  | 'CONFIRMED'
  | 'REVIEWED'
  | 'REJECTED'

export interface Segment {
  id: string
  fileId: string
  order: number
  sourceText: string
  targetText: string
  status: SegmentStatus
  tmScore?: number | null
  translationSource?: 'TM' | 'AQUIFER' | 'DEEPL' | 'CLAUDE' | 'OPENAI' | null
  editorId?: string | null
  revisorId?: string | null
  editor?: Pick<User, 'id' | 'name' | 'email'> | null
  revisor?: Pick<User, 'id' | 'name' | 'email'> | null
  confirmedAt?: string | null
  reviewedAt?: string | null
  flagged: boolean
  comment?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Translation Memory ───────────────────────

export interface TMMatch {
  id: string
  score: number           // 0-100
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
  createdAt: string
  usedCount: number
}

export interface TMSearchResponse {
  matches: TMMatch[]
  query: string
  sourceLang: string
  targetLang: string
}

// ─── Termbase ─────────────────────────────────

export interface TermbaseEntry {
  id: string
  sourceTerm: string
  targetTerm: string
  sourceLang: string
  targetLang: string
  definition?: string | null
  context?: string | null
  domain?: string | null       // e.g. "theology", "liturgy"
  notes?: string | null
  createdAt: string
}

// ─── AI Panel ─────────────────────────────────

export interface AISuggestion {
  translation: string
  confidence: number    // 0-1
  theologicalNote?: string
  contextNote?: string
  alternates?: string[]
}

// ─── Editor State ─────────────────────────────

export interface EditorState {
  activeSegmentId: string | null
  draftTexts: Record<string, string>   // segmentId → draft text
  saving: boolean
  lastSavedAt: string | null
}

// ─── API Response helpers ─────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiError {
  error: string
  details?: Record<string, string[]>
}
