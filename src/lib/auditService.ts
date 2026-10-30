import type { AuditFinding, Lead, QuestionEvaluation } from '../types'
import { normalized } from './leadNormalizer'

const activeEvaluations = (lead: Lead) => lead.questions.flatMap((question) => question.subEvaluations?.filter((item) => !item.isBudgetOnly) ?? [question]).filter((question) => !question.isBudgetOnly)

export function auditLeads(leads: Lead[]): AuditFinding[] {
  const findings: AuditFinding[] = []
  const byKey = new Map<string, { lead: Lead; question: QuestionEvaluation }[]>()
  leads.forEach((lead) => activeEvaluations(lead).forEach((question) => {
    const key = `${question.id}::${normalized(question.answer)}`
    byKey.set(key, [...(byKey.get(key) ?? []), { lead, question }])
  }))
  byKey.forEach((items, key) => {
    const categories = new Set(items.map(({ question }) => normalized(question.category)))
    const points = new Set(items.map(({ question }) => question.points))
    const leadIds = items.map(({ lead }) => lead.id)
    const [questionId] = key.split('::')
    if (items.length > 1 && categories.size > 1) findings.push({ id: `category-${key}`, type: 'category', severity: 'possible', title: `${questionId}: mesma resposta, categorias diferentes`, detail: `A resposta aparece em ${items.length} leads, mas recebeu as categorias ${Array.from(categories).filter(Boolean).join(', ') || 'não informadas'}.`, leadIds, questionId })
    if (items.length > 1 && points.size > 1) {
      const isContextual = questionId === 'Q7'
      findings.push({ id: `points-${key}`, type: isContextual ? 'context' : 'points', severity: isContextual ? 'context' : 'confirmed', title: `${questionId}: mesma resposta, pontuações diferentes`, detail: isContextual ? 'Q7 pode depender de data de envio, gatilhos adicionais ou ajustes registrados. Compare o contexto antes de considerar erro.' : `A mesma resposta recebeu ${Array.from(points).map((point) => point === null ? 'sem nota' : `${point} pts`).join(' e ')}.`, leadIds, questionId })
    }
  })
  leads.forEach((lead) => {
    const individual = activeEvaluations(lead).reduce((sum, question) => sum + (question.points ?? 0), 0) + lead.adjustments
    if (lead.totalScore !== null && Math.abs(individual - lead.totalScore) > 0.01) findings.push({ id: `math-${lead.id}`, type: 'math', severity: 'confirmed', title: `${lead.id}: conferência matemática divergente`, detail: `A soma das notas individuais e ajustes resulta em ${individual} pts, enquanto o total registrado é ${lead.totalScore} pts. q8_budget foi excluído da soma.`, leadIds: [lead.id] })
  })
  return findings
}
