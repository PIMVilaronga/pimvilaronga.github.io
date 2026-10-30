export type Priority = 'A' | 'B' | 'C' | 'D'
export type ReviewStatus = 'pending' | 'reviewed' | 'none'

export interface QuestionEvaluation {
  id: string
  label: string
  title: string
  answer: string
  category?: string
  categoryLabel?: string
  points: number | null
  maxPoints: number | null
  status: string
  evidence?: string
  rule?: string
  reviewReason?: string
  origin?: string
  isBudgetOnly?: boolean
  subEvaluations?: QuestionEvaluation[]
}

export interface Lead {
  id: string
  submittedAt: string
  totalScore: number | null
  maxScore: number | null
  fit: string
  readiness: string
  priority: Priority | string
  policy: string
  model: string
  incomplete: boolean
  questions: QuestionEvaluation[]
  reviews: ReviewIssue[]
  adjustments: number
}

export interface ReviewIssue {
  id: string
  leadId: string
  questionId?: string
  questionLabel?: string
  answer?: string
  category?: string
  points?: number | null
  reason: string
  flags?: string
  status: ReviewStatus
}

export interface AuditFinding {
  id: string
  type: 'category' | 'points' | 'math' | 'context'
  severity: 'confirmed' | 'possible' | 'context'
  title: string
  detail: string
  leadIds: string[]
  questionId?: string
}

export interface ParsedWorkbook {
  leads: Lead[]
  warnings: string[]
  sheets: string[]
}
