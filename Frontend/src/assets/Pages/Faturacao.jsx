import { useState } from 'react'
import estilo from './Faturacao.module.css'
import painel from './Painel.module.css'
import Venda from './Venda'
import Documentos from './Documentos'

const ABAS = [
  { id: 'venda', rotulo: 'Nova venda' },
  { id: 'documentos', rotulo: 'Documentos' },
]

export default function Faturacao() {
  const [aba, setAba] = useState('venda')

  return (
    <div className={estilo.tela}>
      <div className={painel.abas} role="tablist" aria-label="Faturação">
        {ABAS.map((a) => (
          <button
            key={a.id}
            id={`fat-aba-${a.id}`}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            aria-controls={`fat-painel-${a.id}`}
            className={`${painel.aba} ${aba === a.id ? painel.abaAtiva : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {/* as duas ficam montadas: mudar de separador não perde a venda em curso */}
      <div id="fat-painel-venda" role="tabpanel" aria-labelledby="fat-aba-venda" hidden={aba !== 'venda'}>
        <Venda ativo={aba === 'venda'} />
      </div>
      <div id="fat-painel-documentos" role="tabpanel" aria-labelledby="fat-aba-documentos" hidden={aba !== 'documentos'}>
        <Documentos ativo={aba === 'documentos'} />
      </div>
    </div>
  )
}
