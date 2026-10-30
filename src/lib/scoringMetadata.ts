export const questionMetadata: Record<string, { title: string; description: string }> = {
  Q2: { title: 'Objetivo no exterior', description: 'Intenção e contexto do planejamento internacional.' },
  Q3: { title: 'Origem da renda', description: 'Origem e previsibilidade da renda do cliente.' },
  Q4: { title: 'Renda e patrimônio', description: 'Faixa financeira indicada no formulário.' },
  Q5: { title: 'Vínculos com o Brasil', description: 'Relação fiscal, familiar e patrimonial com o país.' },
  Q6: { title: 'País de interesse', description: 'Destino ou jurisdição considerada pelo cliente.' },
  Q7: { title: 'Prazo do planejamento', description: 'Horizonte de tempo para colocar o plano em prática.' },
  Q8: { title: 'Passos já realizados e investimento', description: 'Estágio atual e orçamento declarado para o próximo passo.' },
}

export const q4Categories: Record<string, string> = {
  A: 'Renda e patrimônio abaixo ou iguais aos limites',
  B: 'Patrimônio acima, renda não',
  C: 'Renda acima, patrimônio não',
  D: 'Renda e patrimônio acima dos limites',
  E: 'Prefere informar em conversa',
}

export const questionOrder = ['Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']

export const getQuestionMeta = (id: string) => questionMetadata[id] ?? { title: id, description: '' }
