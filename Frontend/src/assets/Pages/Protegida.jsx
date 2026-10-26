import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { utilizadorAtual, podeVer } from './sessao'

// Sem sessão -> login. Com sessão mas sem permissão para a área -> volta ao Geral.
export default function Protegida() {
  const { pathname } = useLocation()
  const utilizador = utilizadorAtual()

  if (!utilizador) return <Navigate to="/" replace />
  if (!podeVer(utilizador.perfil, pathname)) return <Navigate to="/Geral" replace />
  return <Outlet />
}
