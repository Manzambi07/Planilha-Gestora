// Guarda o token e os dados do utilizador no browser.
// Não importa mais nada, para o api.js e o auth.js poderem usá-lo sem ciclos.
const CHAVE = 'gestor.sessao'

export function sessao() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE))
    return s && s.token && s.utilizador ? s : null
  } catch {
    return null
  }
}

export const guardarSessao = (token, utilizador) =>
  localStorage.setItem(CHAVE, JSON.stringify({ token, utilizador }))

export const limparSessao = () => localStorage.removeItem(CHAVE)

export const token = () => (sessao() ? sessao().token : null)
export const utilizadorAtual = () => (sessao() ? sessao().utilizador : null)

// perfis que podem ver cada área (null = todos com sessão)
export const ACESSO = {
  '/Geral': null,
  '/Faturacao': null,
  '/User': ['admin'],
  '/Analise': ['admin', 'gestor'],
  '/Def': null,
}

export const podeVer = (perfil, caminho) => {
  const perfis = ACESSO[caminho]
  return !perfis || perfis.includes(perfil)
}
