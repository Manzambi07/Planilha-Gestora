import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, RefreshCw } from 'lucide-react'
import estilo from './Faturacao.module.css'
import painel from './Painel.module.css'
import modal from './Modal.module.css'
import './impressao.css'
import { pedir } from './api'
import { kz, n } from './formatar'

const hoje = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10) // dia em Angola (UTC+1)
const formatarData = (iso) => iso.split('-').reverse().join('/')

// o relatório tal como sai no ecrã e no papel
function Relatorio({ d }) {
  return (
    <article className={estilo.doc}>
      <div className={estilo.docTopo}>
        <div className={estilo.docEmpresa}><strong>Fecho do dia</strong><div>{formatarData(d.data)}</div></div>
        <div className={estilo.docTitulo}>
          <div>{d.ambito === 'proprio' ? 'Apenas as minhas vendas' : 'Todos os operadores'}</div>
        </div>
      </div>

      <table className={estilo.docTabela}>
        <thead><tr><th>Documentos emitidos</th><th className={estilo.dir}>Quantidade</th><th className={estilo.dir}>Anulados</th><th className={estilo.dir}>Valor</th></tr></thead>
        <tbody>
          {d.emitidos.length === 0 && <tr><td colSpan={4}>Nenhum documento emitido neste dia.</td></tr>}
          {d.emitidos.map((e) => (
            <tr key={e.tipo}><td>{e.tipoNome}</td><td className={estilo.dir}>{n(e.quantidade)}</td><td className={estilo.dir}>{n(e.anuladas)}</td><td className={estilo.dir}>{kz(e.total)}</td></tr>
          ))}
        </tbody>
      </table>

      <table className={estilo.docTabela}>
        <thead><tr><th>Recebido por método</th><th className={estilo.dir}>Pagamentos</th><th className={estilo.dir}>Valor</th></tr></thead>
        <tbody>
          {d.recebidos.length === 0 && <tr><td colSpan={3}>Nenhum pagamento recebido neste dia.</td></tr>}
          {d.recebidos.map((r) => (
            <tr key={r.metodo}><td>{r.metodo}</td><td className={estilo.dir}>{n(r.quantidade)}</td><td className={estilo.dir}>{kz(r.total)}</td></tr>
          ))}
        </tbody>
      </table>

      {d.operadores.length > 0 && (
        <table className={estilo.docTabela}>
          <thead><tr><th>Recebido por operador</th><th className={estilo.dir}>Documentos</th><th className={estilo.dir}>Valor</th></tr></thead>
          <tbody>
            {d.operadores.map((o) => (
              <tr key={o.operador}><td>{o.operador}</td><td className={estilo.dir}>{n(o.documentos)}</td><td className={estilo.dir}>{kz(o.recebido)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={estilo.docTotais}>
        <div><span>Vendas</span><span>{kz(d.vendas)}</span></div>
        <div><span>Notas de crédito</span><span>- {kz(d.notasCredito)}</span></div>
        <div><span>Vendas líquidas</span><span>{kz(d.vendasLiquidas)}</span></div>
        <div><span>Recebido</span><span>{kz(d.recebidoTotal)}</span></div>
        <div><span>Devolvido (faturas-recibo anuladas)</span><span>- {kz(d.devolvido)}</span></div>
        <div className={estilo.docTotalFinal}><span>Em caixa</span><span>{kz(d.emCaixa)}</span></div>
      </div>

      <div className={estilo.docRodape}>Documento de conferência interna. Não tem valor fiscal.</div>
    </article>
  )
}

export default function Fecho({ ativo }) {
  const [data, setData] = useState(hoje())
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!ativo) return undefined
    const controlador = new AbortController()
    setCarregando(true)
    setErro('')
    pedir(`/api/faturacao/fecho?data=${data}`, { signal: controlador.signal })
      .then((r) => { setD(r); setCarregando(false) })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })
    return () => controlador.abort()
  }, [ativo, data, tentativa])

  return (
    <div className={estilo.lista}>
      <div className={estilo.filtros}>
        <input type="date" aria-label="Dia" value={data} max={hoje()} onChange={(e) => e.target.value && setData(e.target.value)} />
        <button type="button" className={modal.btn} onClick={() => setTentativa((t) => t + 1)} disabled={carregando}>
          <RefreshCw size={16} />&nbsp;Atualizar
        </button>
        <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} onClick={() => window.print()} disabled={!d || carregando}>
          <Printer size={16} />&nbsp;Imprimir
        </button>
      </div>

      {erro && <div className={modal.erro} role="alert">{erro}</div>}
      {carregando && !d && <p className={estilo.mensagem}>A calcular...</p>}

      {d && (
        <>
          <section className={painel.kpis} aria-label="Resumo do dia" style={{ marginBottom: 20 }}>
            <div className={painel.kpi}><p className={painel.kpiRotulo}>Vendas líquidas</p><p className={painel.kpiValor}>{kz(d.vendasLiquidas)}</p><p className={painel.kpiNota}>{formatarData(d.data)}</p></div>
            <div className={painel.kpi}><p className={painel.kpiRotulo}>Recebido</p><p className={painel.kpiValor}>{kz(d.recebidoTotal)}</p><p className={painel.kpiNota}>{d.recebidos.length} método(s)</p></div>
            <div className={painel.kpi}><p className={painel.kpiRotulo}>Devolvido</p><p className={painel.kpiValor}>{kz(d.devolvido)}</p><p className={painel.kpiNota}>Faturas-recibo anuladas</p></div>
            <div className={painel.kpi}><p className={painel.kpiRotulo}>Em caixa</p><p className={painel.kpiValor}>{kz(d.emCaixa)}</p><p className={painel.kpiNota}>Recebido menos devolvido</p></div>
          </section>

          <div className={estilo.folha} style={{ maxHeight: 'none' }}><Relatorio d={d} /></div>

          {/* só existe enquanto este separador está à vista, para não imprimir por cima de outro documento */}
          {ativo && createPortal(<div className={`portal-impressao ${estilo.portalImpressao}`}><Relatorio d={d} /></div>, document.body)}
        </>
      )}
    </div>
  )
}
