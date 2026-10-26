import { ChartArea, Home, LogOut, Receipt, Settings, User } from 'lucide-react'
import style from './index.module.css'
import { NavLink, useLocation } from 'react-router-dom'
import { utilizadorAtual, podeVer } from '../Pages/sessao'
import { sair } from '../Pages/auth'
import { PERFIS } from '../Pages/formatar'

const links = [
    { id: 'geral', texto: 'Geral', icone: Home, to: '/Geral' },
    { id: 'faturacao', texto: 'Faturação', icone: Receipt, to: '/Faturacao' },
    { id: 'usuarios', texto: 'Usuários', icone: User, to: '/User' },
    { id: 'analise', texto: 'Análise', icone: ChartArea, to: '/Analise' },
    { id: 'definicoes', texto: 'Definições', icone: Settings, to: '/Def' },
]

export default function Header() {
    const { pathname } = useLocation()
    const utilizador = utilizadorAtual()

    // só mostra as áreas a que este perfil tem acesso
    const visiveis = links.filter((l) => !utilizador || podeVer(utilizador.perfil, l.to))

    return (
        <header className={style.header}>
            <nav className={style.barra}>
                <ul className={style.lista}>
                    {visiveis.map(({ id, texto, icone: Icone, to }) => {
                        const ativo = pathname === to
                        return (
                            <li
                                key={id}
                                className={`${style.link} ${ativo ? style.ativo : ''}`}
                                aria-current={ativo ? 'page' : undefined}
                            >
                                <NavLink to={to} className={style.link1}>
                                    <Icone size={20} />
                                    <span>{texto}</span>
                                </NavLink>
                            </li>
                        )
                    })}
                </ul>

                {utilizador && (
                    <div className={style.utilizador}>
                        <div className={style.utilizadorTexto}>
                            <span className={style.utilizadorNome}>{utilizador.nome}</span>
                            <span className={style.utilizadorPerfil}>{PERFIS[utilizador.perfil]}</span>
                        </div>
                        <button type="button" className={style.sair} onClick={sair} title="Terminar sessão" aria-label="Terminar sessão">
                            <LogOut size={18} />
                        </button>
                    </div>
                )}
            </nav>
        </header>
    )
}
