import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  document.body.innerHTML = '<main style="font:16px system-ui;padding:32px">Não foi possível iniciar a aplicação: elemento raiz ausente.</main>'
} else {
  try {
    createRoot(rootElement).render(<StrictMode><App /></StrictMode>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido de inicialização.'
    rootElement.innerHTML = `<main style="font:16px system-ui;padding:32px;color:#7d3d31"><h1>Não foi possível carregar o dashboard</h1><p>${message}</p><p>Verifique se as dependências foram instaladas com <code>npm install</code>.</p></main>`
  }
}
