import { useState } from 'react'
import estilo from './Painel.module.css'
import { utilizadorAtual } from './sessao'
import DefEmpresa from './DefEmpresa'
import DefListas from './DefListas'
import DefConta from './DefConta'
import DefAtividade from './DefAtividade'

const ABAS = [
  { id: 'empresa', rotulo: 'Empresa' },
  { id: 'listas', rotulo: 'Impostos e pagamentos' },
  { id: 'conta', rotulo: 'A minha conta' },
  { id: 'atividade', rotulo: 'Atividade', soAdmin: true },
]

export default function Definicoes() {
  const eu = utilizadorAtual()
  const eAdmin = eu && eu.perfil === 'admin'
  const [aba, setAba] = useState('empresa')

  const visiveis = ABAS.filter((a) => !a.soAdmin || eAdmin)

  return (
    <div className={estilo.tela}>
      <div className={estilo.abas} role="tablist" aria-label="Secções das definições">
        {visiveis.map((a) => (
          <button
            key={a.id}
            id={`aba-${a.id}`}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            aria-controls={`painel-${a.id}`}
            className={`${estilo.aba} ${aba === a.id ? estilo.abaAtiva : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div id={`painel-${aba}`} role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === 'empresa' && <DefEmpresa podeEditar={eAdmin} />}
        {aba === 'listas' && <DefListas podeEditar={eAdmin} />}
        {aba === 'conta' && <DefConta />}
        {aba === 'atividade' && eAdmin && <DefAtividade />}
      </div>
    </div>
  )
}
