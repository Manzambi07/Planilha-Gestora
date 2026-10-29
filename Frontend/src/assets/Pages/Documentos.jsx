import { useEffect, useState } from 'react'
import estilo from './Faturacao.module.css'
import modal from './Modal.module.css'
import Documento from './Documento'
import { pedir } from './api'
import { utilizadorAtual } from './sessao'
import { kz, dataHora } from './formatar'

const LIMITE = 20
const classeEstado = {
  emitida: estilo.estadoEmitida, paga: estilo.estadoPaga, parcial: estilo.estadoParcial, anulada: estilo.estadoAnulada,
}
const nomeEstado = { emitida: 'Emitida', paga: 'Paga', parcial: 'Parcial', anulada: 'Anulada' }

export default function Documentos({ ativo }) {
  const podeAnular = ['admin', 'gestor'].includes(utilizadorAtual().perfil)

  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)

  const [dados, setDados] = useState({ total: 0, documentos: [] })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    const espera = setTimeout(() => { setBuscaAplicada(busca.trim()); setPagina(1) }, 300)
    return () => clearTimeout(espera)
  }, [busca])

  useEffect(() => {
    if (!ativo) return undefined
    const controlador = new AbortController()
    setCarregando(true)
    setErro('')
    const params = new URLSearchParams({ pagina, limite: LIMITE })
    if (buscaAplicada) params.set('busca', buscaAplicada)
    if (tipo) params.set('tipo', tipo)
    if (estado) params.set('estado', estado)
    if (desde) params.set('desde', desde)
    if (ate) params.set('ate', ate)

    pedir(`/api/faturacao/documentos?${params}`, { signal: controlador.signal })
      .then((d) => { setDados(d); setCarregando(false) })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })
    return () => controlador.abort()
  }, [ativo, buscaAplicada, tipo, estado, desde, ate, pagina, tentativa])

  const abrir = async (id) => {
    setErro('')
    try {
      const d = await pedir(`/api/faturacao/documentos/${id}`)
      setAberto({ doc: d.documento })
    } catch (e) {
      setErro(e.message)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(dados.total / LIMITE))
  const mudarFiltro = (setter) => (e) => { setter(e.target.value); setPagina(1) }

  return (
    <div className={estilo.lista}>
      <div className={estilo.filtros}>
        <input type="search" placeholder="Pesquisar por número, cliente ou NIF" aria-label="Pesquisar documentos" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Tipo de documento" value={tipo} onChange={mudarFiltro(setTipo)}>
          <option value="">Todos os tipos</option>
          <option value="FR">Fatura-Recibo</option>
          <option value="FT">Fatura</option>
          <option value="NC">Nota de Crédito</option>
        </select>
        <select aria-label="Estado" value={estado} onChange={mudarFiltro(setEstado)}>
          <option value="">Todos os estados</option>
          <option value="paga">Pagas</option>
          <option value="emitida">Por pagar</option>
          <option value="parcial">Parcialmente pagas</option>
          <option value="anulada">Anuladas</option>
        </select>
        <input type="date" aria-label="Desde" value={desde} onChange={mudarFiltro(setDesde)} />
        <input type="date" aria-label="Até" value={ate} onChange={mudarFiltro(setAte)} />
      </div>

      {erro && <div className={modal.erro} role="alert" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className={estilo.caixaTabela}>
        <table className={estilo.tabelaDocs}>
          <thead>
            <tr>
              <th>Número</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Em dívida</th>
            </tr>
          </thead>
          <tbody>
            {carregando && dados.documentos.length === 0 && (
              <tr><td colSpan={6} className={estilo.mensagem}>A carregar documentos...</td></tr>
            )}
            {!carregando && !erro && dados.documentos.length === 0 && (
              <tr><td colSpan={6} className={estilo.mensagem}>Nenhum documento encontrado.</td></tr>
            )}
            {dados.documentos.map((d) => {
              const emDivida = ['FT', 'ND'].includes(d.tipo) && ['emitida', 'parcial'].includes(d.estado) ? d.total - d.pago : 0
              return (
                <tr
                  key={d.id}
                  tabIndex={0}
                  onClick={() => abrir(d.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') abrir(d.id) }}
                >
                  <td><strong>{d.numero}</strong><div style={{ fontSize: 12, color: '#6b7280' }}>{d.tipoNome}</div></td>
                  <td>{dataHora(d.dataEmissao)}</td>
                  <td>{d.cliente ? d.cliente.nome : '—'}{d.cliente && d.cliente.nif ? <div style={{ fontSize: 12, color: '#6b7280' }}>NIF {d.cliente.nif}</div> : null}</td>
                  <td><span className={classeEstado[d.estado]}>{nomeEstado[d.estado]}</span></td>
                  <td style={{ textAlign: 'right' }}>{d.tipo === 'NC' ? `- ${kz(d.total)}` : kz(d.total)}</td>
                  <td style={{ textAlign: 'right' }}>{emDivida > 0 ? kz(emDivida) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dados.total > LIMITE && (
        <div className={estilo.paginacao}>
          <span>Página {pagina} de {totalPaginas} ({dados.total} documentos)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Seguinte</button>
          </div>
        </div>
      )}

      {aberto && (
        <Documento
          doc={aberto.doc}
          segundaVia
          podeAnular={podeAnular}
          aoFechar={() => setAberto(null)}
          aoAtualizar={(doc) => { setAberto({ doc }); setTentativa((t) => t + 1) }}
        />
      )}
    </div>
  )
}
