import * as XLSX from 'xlsx'
import type { Lead, ParsedWorkbook } from '../types'
import { cleanText, findLooseValue, findValue, groupQuestions, makeReviewIssues, toNumber, normalizeDetailRow } from './leadNormalizer'
import { getQuestionMeta } from './scoringMetadata'

const sheetAliases: Record<string, string[]> = {
  summary: ['Resumo', 'Summary'], detail: ['Detalhamento', 'Detail', 'Detalhes'], scores: ['Pontuações', 'Pontuacoes', 'Scores'], reviews: ['Revisões', 'Revisoes', 'Reviews'],
}

const findSheet = (workbook: XLSX.WorkBook, aliases: string[]) => workbook.SheetNames.find((name) => aliases.some((alias) => name.trim().toLocaleLowerCase('pt-BR') === alias.toLocaleLowerCase('pt-BR')))
const rowsFrom = (workbook: XLSX.WorkBook, sheet: string | undefined) => sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: '' }) : []

const leadIdOf = (row: Record<string, unknown>) => cleanText(findValue(row, ['Lead', 'lead_id', 'ID do lead', 'Identificador', 'ID']))

const formatSubmittedAt = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()} · ${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')} UTC`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()} · ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
  }
  return cleanText(value) || 'Data não informada'
}

export async function parseXlsxFile(file: File): Promise<ParsedWorkbook> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const sheetNames = Object.keys(sheetAliases).reduce<Record<string, string | undefined>>((acc, key) => { acc[key] = findSheet(workbook, sheetAliases[key]); return acc }, {})
  const warnings: string[] = []
  const required = ['summary', 'scores', 'detail', 'reviews']
  const labels: Record<string, string> = { summary: 'Resumo', scores: 'Pontuações', detail: 'Detalhamento', reviews: 'Revisões' }
  required.forEach((key) => { if (!sheetNames[key]) warnings.push(`A aba obrigatória “${labels[key]}” não foi encontrada.`) })
  if (warnings.length) throw new Error(warnings.join(' '))
  const summaryRows = rowsFrom(workbook, sheetNames.summary)
  const detailRows = rowsFrom(workbook, sheetNames.detail)
  const scoreRows = rowsFrom(workbook, sheetNames.scores)
  const reviewRows = rowsFrom(workbook, sheetNames.reviews)
  const summaryColumns = Object.keys(summaryRows[0] ?? {})
  const detailColumns = Object.keys(detailRows[0] ?? {})
  if (!summaryColumns.some((column) => /lead|id/i.test(column))) warnings.push('A aba Resumo não possui uma coluna de identificação “Lead”.')
  if (!summaryColumns.some((column) => /score|pontuação|pontuacao/i.test(column))) warnings.push('A aba Resumo não possui uma coluna de score total.')
  if (!detailColumns.some((column) => /lead|id/i.test(column))) warnings.push('A aba Detalhamento não possui uma coluna de identificação “Lead”.')
  if (!detailColumns.some((column) => /pergunta|question|questão|questao|critério|criterio|q[2-8]/i.test(column))) warnings.push('A aba Detalhamento não possui uma coluna de pergunta ou critério.')
  if (warnings.length) throw new Error(warnings.join(' '))
  const leadIds = Array.from(new Set([...summaryRows, ...detailRows].map(leadIdOf).filter(Boolean)))
  if (!leadIds.length) throw new Error('Nenhum identificador “Lead” foi encontrado nas abas Resumo ou Detalhamento.')
  const leads: Lead[] = leadIds.map((id) => {
    const summary = summaryRows.find((row) => leadIdOf(row) === id) ?? {}
    const details = detailRows.filter((row) => leadIdOf(row) === id).map(normalizeDetailRow).filter((row): row is NonNullable<typeof row> => Boolean(row))
    const questions = groupQuestions(details)
    const scoreRow = scoreRows.find((row) => leadIdOf(row) === id) ?? {}
    const reviews = makeReviewIssues(id, questions, reviewRows)
    const totalScore = toNumber(findValue(summary, ['Score total', 'Score', 'Pontuação total', 'Total']))
    const maxScore = toNumber(findValue(summary, ['Score máximo', 'Máximo', 'Max score', 'Total máximo'])) ?? 90
    return {
      id,
      submittedAt: formatSubmittedAt(findValue(summary, ['Envio (UTC)', 'Data de envio', 'Data', 'Submitted at', 'Created at'])),
      totalScore,
      maxScore,
      fit: cleanText(findValue(summary, ['Fit'])) || '—',
      readiness: cleanText(findValue(summary, ['Readiness', 'Prontidão'])) || '—',
      priority: cleanText(findValue(summary, ['Faixa', 'Prioridade comercial', 'Prioridade', 'Tier'])) || '—',
      policy: cleanText(findValue(summary, ['Política', 'Policy'])) || cleanText(findValue(scoreRow, ['Política', 'Policy'])) || 'Não informada',
      model: cleanText(findValue(summary, ['Modelo', 'Model'])) || 'Não informado',
      incomplete: /sim|incomplet|ausente|pend/i.test(`${findValue(summary, ['Score incompleto?', 'Status', 'Classificação']) ?? ''}`) || questions.some((question) => question.points === null),
      questions: questions.length ? questions : ['Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'].map((id) => ({ id, label: id, title: getQuestionMeta(id).title, answer: 'Não encontrada no arquivo', points: null, maxPoints: null, status: 'Dado ausente' })),
      reviews,
      adjustments: toNumber(findValue(summary, ['Ajustes', 'Ajuste', 'Adjustments'])) ?? 0,
    }
  })
  return { leads, warnings, sheets: workbook.SheetNames }
}
