import { pedir } from './api'
import { guardarSessao, limparSessao } from './sessao'

export async function entrar(email, senha) {
  const dados = await pedir('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  guardarSessao(dados.token, dados.utilizador)
  return dados.utilizador
}

export function sair() {
  limparSessao()
  window.location.assign('/')
}
