import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { auditLeads } from './lib/auditService'
import { parseXlsxFile } from './lib/xlsxParser'
import { getQuestionMeta, questionOrder } from './lib/scoringMetadata'
import { demoLeads } from './data/demoData'
import type { AuditFinding, Lead, QuestionEvaluation, ReviewIssue } from './types'

type View = 'leads' | 'compare' | 'audit'
type IconName = 'search' | 'upload' | 'chevron' | 'check' | 'alert' | 'filter' | 'sort' | 'columns' | 'audit' | 'download' | 'refresh' | 'arrow' | 'close'

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
    upload: <><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 14v5h16v-5"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    filter: <><path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/></>,
    sort: <><path d="M7 4v16"/><path d="m4 7 3-3 3 3"/><path d="M17 20V4"/><path d="m14 17 3 3 3-3"/></>,
    columns: <><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></>,
    audit: <><path d="M4 19V5"/><path d="M4 5c4-3 8 3 16 0v9c-8 3-12-3-16 0"/></>,
    download: <><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const formatScore = (score: number | null, max = 90) => score === null ? '—' : `${score}/${max}`
const questionIcon = (id: string) => ({ Q2: '◎', Q3: '◌', Q4: '◈', Q5: '⌂', Q6: '◇', Q7: '◷', Q8: '↗' }[id] ?? '•')

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'red' | 'ink' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function ScoreRing({ value, max = 90 }: { value: number | null; max?: number }) {
  const percent = value === null ? 0 : Math.min(100, (value / max) * 100)
  return <div className="score-ring" style={{ '--score': `${percent * 3.6}deg` } as CSSProperties}><div><strong>{value ?? '—'}</strong><span>/{max}</span></div></div>
}

function EmptyState({ onUpload, title = 'Comece importando seu arquivo' }: { onUpload: () => void; title?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="upload" size={24}/></div><h2>{title}</h2><p>Leia o XLSX gerado pelo pipeline e abra os leads para auditar cada decisão.</p><button className="button button-primary" onClick={onUpload}><Icon name="upload" size={15}/> Selecionar XLSX</button><span className="empty-note">Processamento 100% local · arquivo não sai do navegador</span></div>
}

function ReviewToggle({ review, onToggle }: { review?: ReviewIssue; onToggle: () => void }) {
  if (!review) return null
  const reviewed = review.status === 'reviewed'
  return <button className={`review-toggle ${reviewed ? 'is-reviewed' : ''}`} onClick={onToggle}><span className="review-dot">{reviewed ? <Icon name="check" size={11}/> : <Icon name="alert" size={11}/>}</span>{reviewed ? 'Revisado localmente' : 'Marcar como revisado'}</button>
}

function QuestionCard({ question, review, onReview }: { question: QuestionEvaluation; review?: ReviewIssue; onReview: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const scoreText = question.points === null ? 'Sem nota' : `${question.points}/${question.maxPoints ?? '—'}`
  return <article className={`question-card ${question.reviewReason ? 'question-review' : ''}`}>
    <button className="question-head" onClick={() => setExpanded(!expanded)}>
      <span className="question-number">{questionIcon(question.id)}</span>
      <span className="question-heading"><small>{question.label}</small><strong>{question.title}</strong></span>
      <span className="question-score"><b>{scoreText}</b><span>{question.points !== null ? 'pontos atribuídos' : 'verificar no arquivo'}</span></span>
      {question.reviewReason && <span className="review-flag"><Icon name="alert" size={13}/> revisão</span>}
      <span className={`question-chevron ${expanded ? 'open' : ''}`}><Icon name="chevron" size={18}/></span>
    </button>
    {expanded && <div className="question-body">
      <div className="answer-panel"><span className="eyebrow">Resposta do cliente</span><p>{question.answer}</p></div>
      <div className="evaluation-grid">
        <div><span className="eyebrow">Opção técnica</span><p><strong>{question.id === 'Q4' && question.category ? `Opção financeira: ${question.category}` : question.category || 'Não informada'}</strong>{question.categoryLabel && <small>{question.categoryLabel}</small>}</p></div>
        <div><span className="eyebrow">Interpretação</span><p>{question.evidence || <span className="muted">Evidência da LLM ausente no arquivo.</span>}</p></div>
        <div><span className="eyebrow">Regra utilizada</span><p>{question.rule || <span className="muted">Regra não informada no arquivo.</span>}</p></div>
        <div><span className="eyebrow">Origem / status</span><p>{question.origin || 'Origem não informada'}<small>{question.status}</small></p></div>
      </div>
      {question.subEvaluations && <div className="sub-evaluations"><span className="eyebrow">Avaliações internas de Q8</span>{question.subEvaluations.map((sub, index) => <div className={`sub-row ${sub.isBudgetOnly ? 'budget-row' : ''}`} key={`${sub.id}-${index}`}><span><b>{sub.isBudgetOnly ? 'Orçamento' : 'Etapa'}</b>{sub.answer}</span><strong>{sub.isBudgetOnly ? '0 · fora da política' : `${sub.points ?? '—'}/${sub.maxPoints ?? '—'}`}</strong></div>)}</div>}
      {question.reviewReason && <div className="review-reason"><Icon name="alert" size={15}/><span><b>Motivo de revisão</b>{question.reviewReason}</span><ReviewToggle review={review} onToggle={onReview}/></div>}
    </div>}
  </article>
}

function LeadSidebar({ leads, selectedId, onSelect, search, setSearch, priority, setPriority, onlyPending, setOnlyPending, sort, setSort, compareIds, toggleCompare, onCompare, onUpload }: { leads: Lead[]; selectedId: string | null; onSelect: (id: string) => void; search: string; setSearch: (value: string) => void; priority: string; setPriority: (value: string) => void; onlyPending: boolean; setOnlyPending: (value: boolean) => void; sort: string; setSort: (value: string) => void; compareIds: string[]; toggleCompare: (id: string) => void; onCompare: () => void; onUpload: () => void }) {
  const visible = leads.filter((lead) => lead.id.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (priority === 'all' || lead.priority === priority) && (!onlyPending || lead.reviews.some((review) => review.status === 'pending'))).sort((a, b) => sort === 'low' ? (a.totalScore ?? -1) - (b.totalScore ?? -1) : (b.totalScore ?? -1) - (a.totalScore ?? -1))
  return <aside className="sidebar">
    <div className="sidebar-heading"><div><span className="eyebrow">Base importada</span><h2>Leads <span>{leads.length}</span></h2></div><button className="icon-button" title="Importar outro arquivo" onClick={onUpload}><Icon name="upload" size={16}/></button></div>
    <div className="search-box"><Icon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ID…"/><kbd>/</kbd></div>
    <div className="filter-row"><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filtrar prioridade"><option value="all">Prioridade: todas</option><option value="A">Prioridade A</option><option value="B">Prioridade B</option><option value="C">Prioridade C</option><option value="D">Prioridade D</option></select><button className="sort-button" onClick={() => setSort(sort === 'high' ? 'low' : 'high')} title="Alternar ordenação"><Icon name="sort" size={15}/>{sort === 'high' ? 'Maior score' : 'Menor score'}</button></div>
    <label className="switch-row"><span><span className={`switch ${onlyPending ? 'on' : ''}`}><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)}/><i/></span> Apenas com pendências</span><span className="result-count">{visible.length}</span></label>
    <div className="lead-list">{visible.map((lead) => <button className={`lead-item ${selectedId === lead.id ? 'selected' : ''}`} key={lead.id} onClick={() => onSelect(lead.id)}><span className={`priority-marker priority-${lead.priority}`}>{lead.priority}</span><span className="lead-copy"><strong>{lead.id}</strong><small>{lead.submittedAt}</small></span><span className="lead-score"><b>{formatScore(lead.totalScore, lead.maxScore ?? 90)}</b>{lead.reviews.some((review) => review.status === 'pending') && <i title="Revisão pendente"><Icon name="alert" size={12}/></i>}</span><span className="lead-chevron"><Icon name="chevron" size={15}/></span><span className="compare-check" onClick={(event) => { event.stopPropagation(); toggleCompare(lead.id) }} title="Selecionar para comparar">{compareIds.includes(lead.id) ? <Icon name="check" size={13}/> : '+'}</span></button>)}{!visible.length && <div className="sidebar-empty">Nenhum lead corresponde aos filtros.</div>}</div>
    {compareIds.length > 0 && <div className="compare-dock"><span><b>{compareIds.length}</b> selecionado{compareIds.length > 1 ? 's' : ''}</span><button onClick={onCompare} disabled={compareIds.length < 2}>Comparar <Icon name="arrow" size={14}/></button></div>}
  </aside>
}

function DetailView({ lead, localReviews, toggleReview, onOpenCompare }: { lead: Lead; localReviews: Record<string, ReviewIssue>; toggleReview: (review: ReviewIssue) => void; onOpenCompare: () => void }) {
  const pending = lead.reviews.filter((review) => (localReviews[review.id]?.status ?? review.status) === 'pending').length
  return <div className="detail-view">
    <div className="detail-topline"><span className="breadcrumb">Leads <Icon name="chevron" size={12}/> {lead.id}</span><button className="button button-ghost" onClick={onOpenCompare}><Icon name="columns" size={15}/> Comparar este lead</button></div>
    <section className="lead-header"><div className="lead-intro"><div className="avatar-mark">{lead.id.replace('csv:', '')}</div><div><div className="title-line"><h1>{lead.id}</h1><Badge tone={lead.priority === 'A' ? 'green' : lead.priority === 'B' ? 'blue' : lead.priority === 'C' ? 'amber' : 'neutral'}>Prioridade comercial: {lead.priority}</Badge>{lead.incomplete && <Badge tone="amber"><Icon name="alert" size={12}/> Score incompleto</Badge>}</div><p>Enviado em {lead.submittedAt}</p></div></div><div className="header-actions"><div className="compact-meta"><span>Política <b>{lead.policy}</b></span><span>Modelo <b>{lead.model}</b></span></div><ScoreRing value={lead.totalScore} max={lead.maxScore ?? 90}/></div></section>
    <div className="metric-strip"><div><span>Fit</span><strong>{lead.fit}</strong></div><div><span>Readiness</span><strong>{lead.readiness}</strong></div><div><span>Revisões pendentes</span><strong className={pending ? 'text-amber' : ''}>{pending.toString().padStart(2, '0')}</strong></div><div><span>Máximo possível</span><strong>{lead.maxScore ?? 90} pts</strong></div></div>
    <section className="content-section"><div className="section-heading"><div><span className="eyebrow">Auditoria individual</span><h2>Respostas e avaliação</h2></div><p>Sete critérios · origem e regra preservadas do pipeline</p></div><div className="question-list">{questionOrder.map((id) => { const question = lead.questions.find((item) => item.id === id) ?? { id, label: id, title: getQuestionMeta(id).title, answer: 'Não encontrada no arquivo', points: null, maxPoints: null, status: 'Dado ausente' }; const review = lead.reviews.find((item) => item.questionId === id); return <QuestionCard key={id} question={question} review={review ? (localReviews[review.id] ?? review) : undefined} onReview={() => review && toggleReview(review)}/> })}</div></section>
  </div>
}

function CompareView({ leads, onRemove, onSelectLead }: { leads: Lead[]; onRemove: (id: string) => void; onSelectLead: (id: string) => void }) {
  return <div className="compare-view"><div className="page-heading"><div><span className="eyebrow">Leitura lado a lado</span><h1>Comparar leads</h1><p>Diferenças de nota ficam realçadas; respostas completas permanecem acessíveis.</p></div><Badge tone="blue">{leads.length} de 3 leads</Badge></div><div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>Critério</th>{leads.map((lead) => <th key={lead.id}><div className="compare-person"><span className={`priority-marker priority-${lead.priority}`}>{lead.priority}</span><button onClick={() => onSelectLead(lead.id)}>{lead.id}</button><button className="remove-compare" onClick={() => onRemove(lead.id)}><Icon name="close" size={13}/></button></div><small>{formatScore(lead.totalScore, lead.maxScore ?? 90)} · {lead.fit} fit</small></th>)}</tr></thead><tbody>{questionOrder.map((id) => { const questions = leads.map((lead) => lead.questions.find((item) => item.id === id)); const scores = questions.map((question) => question?.points).filter((point): point is number => point !== null && point !== undefined); const different = new Set(scores).size > 1; return <tr key={id}><td><b>{id}</b><span>{getQuestionMeta(id).title}</span></td>{questions.map((question, index) => <td className={different ? 'different' : ''} key={`${leads[index].id}-${id}`}><p>{question?.answer ?? '—'}</p><div className="compare-meta"><strong>{question?.points ?? '—'}{question?.maxPoints ? `/${question.maxPoints}` : ''}</strong><span>{question?.category ? `${id === 'Q4' ? 'Opção financeira' : 'Categoria'} ${question.category}` : 'Sem categoria'}</span></div>{question?.reviewReason && <span className="mini-review"><Icon name="alert" size={12}/> {question.reviewReason}</span>}</td>)}</tr> })}</tbody></table></div></div>
}

function AuditView({ findings, leads, onSelectLead }: { findings: AuditFinding[]; leads: Lead[]; onSelectLead: (id: string) => void }) {
  return <div className="audit-view"><div className="page-heading"><div><span className="eyebrow">Controle de qualidade</span><h1>Auditoria</h1><p>Possíveis divergências identificadas sem alterar os dados originais.</p></div><div className="audit-summary"><strong>{findings.length}</strong><span>achados</span></div></div><div className="audit-legend"><span><i className="dot dot-confirmed"/>Erro comprovado</span><span><i className="dot dot-possible"/>Possível inconsistência</span><span><i className="dot dot-context"/>Diferença contextual</span></div>{findings.length ? <div className="finding-list">{findings.map((finding) => <article className={`finding finding-${finding.severity}`} key={finding.id}><div className="finding-icon">{finding.type === 'math' ? 'Σ' : finding.type === 'context' ? '◌' : finding.type === 'category' ? '≠' : '!'}</div><div className="finding-body"><div className="finding-title"><span className="eyebrow">{finding.questionId ?? 'Pontuação total'} · {finding.severity === 'confirmed' ? 'erro comprovado' : finding.severity === 'context' ? 'contexto a verificar' : 'possível inconsistência'}</span><h3>{finding.title}</h3></div><p>{finding.detail}</p><div className="finding-leads">{finding.leadIds.map((id) => <button key={id} onClick={() => onSelectLead(id)}>{id} <Icon name="arrow" size={12}/></button>)}</div></div></article>)}</div> : <div className="clean-audit"><div className="clean-icon"><Icon name="check" size={22}/></div><h2>Nenhuma divergência encontrada</h2><p>As avaliações atuais não apresentaram diferenças que o sistema consiga sinalizar automaticamente.</p></div>}{leads.length > 0 && <p className="audit-footnote">A auditoria normaliza espaços, quebras de linha e caixa. Q7 permanece contextual por poder depender de data de envio e ajustes.</p>}</div>
}

function App() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [leads, setLeads] = useState<Lead[]>(demoLeads)
  const [sourceName, setSourceName] = useState('Dados de exemplo')
  const [view, setView] = useState<View>('leads')
  const [selectedId, setSelectedId] = useState<string | null>(demoLeads[0].id)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [onlyPending, setOnlyPending] = useState(false)
  const [sort, setSort] = useState('high')
  const [localReviews, setLocalReviews] = useState<Record<string, ReviewIssue>>({})
  const [error, setError] = useState('')
  const findings = useMemo(() => auditLeads(leads), [leads])
  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? leads[0]

  const openFile = () => fileInput.current?.click()
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try { const parsed = await parseXlsxFile(file); setLeads(parsed.leads); setSourceName(file.name); setSelectedId(parsed.leads[0]?.id ?? null); setCompareIds([]); setView('leads') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível ler esse arquivo.') }
    event.target.value = ''
  }
  const toggleCompare = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current)
  const toggleReview = (review: ReviewIssue) => setLocalReviews((current) => ({ ...current, [review.id]: { ...review, status: (current[review.id]?.status ?? review.status) === 'reviewed' ? 'pending' : 'reviewed' } }))
  const goToLead = (id: string) => { setSelectedId(id); setView('leads') }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">S</span><span className="brand-word">settee</span><span className="brand-divider"/><span className="brand-product">Lead scoring <b>audit</b></span></div><div className="top-actions"><span className="local-status"><i/> local only</span><button className="button button-outline" onClick={openFile}><Icon name="upload" size={15}/> Importar XLSX</button><input ref={fileInput} type="file" accept=".xlsx,.xls" hidden onChange={handleFile}/></div></header>
    {error && <div className="error-banner"><Icon name="alert" size={16}/><span>{error}</span><button onClick={() => setError('')}><Icon name="close" size={15}/></button></div>}
    <div className="app-body"><LeadSidebar leads={leads} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setView('leads') }} search={search} setSearch={setSearch} priority={priority} setPriority={setPriority} onlyPending={onlyPending} setOnlyPending={setOnlyPending} sort={sort} setSort={setSort} compareIds={compareIds} toggleCompare={toggleCompare} onCompare={() => setView('compare')} onUpload={openFile}/><main className="main-content"><nav className="view-tabs"><button className={view === 'leads' ? 'active' : ''} onClick={() => setView('leads')}><span>01</span> Leads</button><button className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}><span>02</span> Comparar {compareIds.length > 0 && <em>{compareIds.length}</em>}</button><button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}><span>03</span> Auditoria {findings.length > 0 && <em className="alert-tab">{findings.length}</em>}</button><span className="source-label"><Icon name="check" size={13}/> {sourceName}</span></nav>{view === 'leads' && selectedLead ? <DetailView lead={selectedLead} localReviews={localReviews} toggleReview={toggleReview} onOpenCompare={() => { if (!compareIds.includes(selectedLead.id)) setCompareIds((ids) => ids.length < 3 ? [...ids, selectedLead.id] : ids); setView('compare') }}/> : view === 'compare' ? (compareIds.length >= 2 ? <CompareView leads={compareIds.map((id) => leads.find((lead) => lead.id === id)).filter((lead): lead is Lead => Boolean(lead))} onRemove={(id) => setCompareIds((ids) => ids.filter((item) => item !== id))} onSelectLead={goToLead}/> : <EmptyState onUpload={() => { if (selectedLead) setCompareIds([selectedLead.id]); openFile() }} title="Selecione dois ou três leads"/>) : <AuditView findings={findings} leads={leads} onSelectLead={goToLead}/>}</main></div>
    {leads.length === 0 && <div className="full-empty"><EmptyState onUpload={openFile}/></div>}
  </div>
}

export default App
