import { token, limparSessao } from './sessao'

// endereço do backend (podes mudar com VITE_API_URL no .env do Frontend)
export const API = import.meta.env.VITE_API_URL || 'http://localhost:7449'

// Faz o pedido (com o token da sessão) e devolve o JSON.
// Se der erro, lança Error com uma mensagem legível.
// Se a sessão tiver expirado (401), limpa-a e volta ao login.
export async function pedir(caminho, init = {}) {
  const t = token()
  const headers = new Headers(init.headers)
  if (t) headers.set('Authorization', `Bearer ${t}`)

  let resposta
  try {
    resposta = await fetch(`${API}${caminho}`, { ...init, headers })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error('Não foi possível ligar ao servidor.')
  }

  const dados = await resposta.json().catch(() => ({}))

  if (resposta.status === 401 && t && !caminho.startsWith('/api/auth/login')) {
    limparSessao()
    window.location.assign('/')
    throw new Error(dados.erro || 'A sessão expirou.')
  }
  if (!resposta.ok) throw new Error(dados.erro || 'Ocorreu um erro. Tenta novamente.')
  return dados
}
