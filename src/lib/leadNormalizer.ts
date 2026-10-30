import { getQuestionMeta, questionOrder, q4Categories } from './scoringMetadata'
import type { Lead, QuestionEvaluation, ReviewIssue } from '../types'

export const cleanText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()
export const normalized = (value: unknown): string => cleanText(value).toLocaleLowerCase('pt-BR')

export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cleanText(value).replace(',', '.')
  if (!text) return null
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export const findValue = (row: Record<string, unknown>, names: string[]): unknown => {
  const entries = Object.entries(row)
  const wanted = names.map((name) => normalized(name))
  const entry = entries.find(([key]) => wanted.includes(normalized(key)))
  return entry?.[1]
}

export const findLooseValue = (row: Record<string, unknown>, pattern: RegExp): unknown => {
  const entry = Object.entries(row).find(([key]) => pattern.test(normalized(key)))
  return entry?.[1]
}

const questionKey = (value: unknown): string | null => {
  const match = cleanText(value).toUpperCase().match(/Q[2-8]/)
  return match?.[0] ?? null
}

export function normalizeDetailRow(row: Record<string, unknown>): QuestionEvaluation | null {
  const descriptor = cleanText(findValue(row, ['Pergunta', 'Question', 'Questão', 'ID', 'Critério', 'Campo', 'Subcritério', 'Tipo']) ?? findLooseValue(row, /q[2-8]/i))
  const id = questionKey(descriptor)
  if (!id) return null
  const category = cleanText(findValue(row, ['Categoria', 'Category', 'Classificação', 'Opção']))
  const answer = cleanText(findValue(row, ['Resposta original', 'Resposta', 'Answer', 'Valor', 'Resposta do cliente']))
  const points = toNumber(findValue(row, ['Pontos', 'Score', 'Nota', 'Points']))
  const maxPoints = toNumber(findValue(row, ['Máximo', 'Max', 'Pontos máximos', 'Max points']))
  const evidence = cleanText(findValue(row, ['Evidência da LLM', 'Evidência', 'Evidence', 'Evidência extraída', 'LLM evidence']))
  const rule = cleanText(findValue(row, ['Regra de pontuação (Python)', 'Regra', 'Regra de pontuação', 'Rule', 'Scoring rule']))
  const reviewReason = cleanText(findValue(row, ['Motivo de revisão', 'Motivo da revisão', 'Motivo', 'Review reason', 'Pendência']))
  const origin = cleanText(findValue(row, ['Origem', 'Source', 'Origem da categoria']))
  const status = cleanText(findValue(row, ['Status da classificação', 'Status', 'Classificação', 'Review status'])) || (reviewReason ? 'Revisão necessária' : 'Classificado')
  const meta = getQuestionMeta(id)
  const isBudgetOnly = id === 'Q8' && /q8[_ -]?budget|budget|orçamento/i.test(descriptor)
  return {
    id,
    label: id,
    title: meta.title,
    answer: answer || 'Resposta não informada',
    category: category || undefined,
    categoryLabel: id === 'Q4' && category ? q4Categories[category] : undefined,
    points,
    maxPoints,
    status,
    evidence: evidence || undefined,
    rule: rule || undefined,
    reviewReason: reviewReason || undefined,
    origin: origin || undefined,
    isBudgetOnly,
  }
}

export const groupQuestions = (rows: QuestionEvaluation[]): QuestionEvaluation[] => {
  const grouped = new Map<string, QuestionEvaluation[]>()
  rows.forEach((row) => grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]))
  return questionOrder.map((id) => {
    const items = grouped.get(id) ?? []
    if (!items.length) return {
      id, label: id, title: getQuestionMeta(id).title, answer: 'Não encontrada no arquivo', points: null, maxPoints: null,
      status: 'Dado ausente', reviewReason: 'Pergunta não localizada na aba Detalhamento.',
    }
    if (id !== 'Q8' || items.length === 1) return items[0]
    const stage = items.find((item) => !item.isBudgetOnly && /stage|etapa|passos/i.test(`${item.id} ${item.answer} ${item.category}`)) ?? items.find((item) => !item.isBudgetOnly) ?? items[0]
    const budget = items.find((item) => item !== stage && (item.isBudgetOnly || /budget|orçamento|investimento/i.test(`${item.answer} ${item.category}`)))
    return {
      ...stage,
      id: 'Q8',
      title: getQuestionMeta('Q8').title,
      subEvaluations: budget ? [stage, budget] : items,
    }
  })
}

export function makeReviewIssues(leadId: string, rows: QuestionEvaluation[], rawReviews: Record<string, unknown>[] = []): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  rows.forEach((question) => {
    if (question.reviewReason || /pend|revis|ambig|incomplet|ausente|missing/i.test(question.status)) {
      issues.push({ id: `${leadId}-${question.id}`, leadId, questionId: question.id, questionLabel: question.title, answer: question.answer, category: question.category, points: question.points, reason: question.reviewReason ?? question.status, status: 'pending' })
    }
  })
  rawReviews.forEach((row, index) => {
    const reason = cleanText(findValue(row, ['Motivo', 'Motivo de revisão', 'Motivo da revisão', 'Descrição', 'Description', 'Reason', 'Pendência', 'Flag']))
    if (!reason && !findValue(row, ['Lead', 'lead_id', 'ID'])) return
    const id = cleanText(findValue(row, ['Lead', 'lead_id', 'ID'])) || leadId
    if (id !== leadId) return
    const questionId = questionKey(findValue(row, ['Pergunta', 'Question', 'Questão'])) ?? undefined
    issues.push({ id: `${leadId}-review-${index}`, leadId, questionId, questionLabel: questionId ? getQuestionMeta(questionId).title : 'Geral', answer: cleanText(findValue(row, ['Resposta', 'Answer'])), category: cleanText(findValue(row, ['Categoria', 'Category'])), points: toNumber(findValue(row, ['Pontos', 'Score', 'Score atual'])), reason: reason || 'Pendência registrada na aba Revisões.', flags: cleanText(findValue(row, ['Flags', 'Sinalizações', 'Tipo'])), status: 'pending' })
  })
  return Array.from(new Map(issues.map((item) => [item.id, item])).values())
}

export const sumScoredPoints = (questions: QuestionEvaluation[]) => questions.reduce((total, question) => total + (question.isBudgetOnly ? 0 : (question.points ?? 0)), 0)

