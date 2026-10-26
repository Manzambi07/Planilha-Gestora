import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Wallet, Ban } from 'lucide-react'
import Modal from './Modal'
import modal from './Modal.module.css'
import estilo from './Faturacao.module.css'
import { pedir } from './api'
import { kz, n, dataHora } from './formatar'
import { paraCentimos, deCentimos, resumoPorTaxa } from './calculos'

const ESTADOS = { emitida: 'Emitida', paga: 'Paga', parcial: 'Parcialmente paga', anulada: 'Anulada' }

// O documento tal como sai no ecrã e no papel
function Folha({ doc, formato, troco }) {
  const e = doc.empresa || {}
  const grupos = resumoPorTaxa(doc.itens.map((i) => ({
    ivaPercentagem: i.ivaPercentagem,
    base: paraCentimos(i.totalLinha) - paraCentimos(i.ivaValor),
    iva: paraCentimos(i.ivaValor),
  })))
  const certificado = doc.programa && doc.programa.certificado

  return (
    <article className={`${estilo.doc} ${formato === '80' ? estilo.doc80 : ''}`}>
      {doc.estado === 'anulada' && <div className={estilo.marcaAnulada}>ANULADA</div>}

      <div className={estilo.docTopo}>
        <div className={estilo.docEmpresa}>
          {e.logotipo && <img className={estilo.docLogo} src={e.logotipo} alt="" />}
          <strong>{e.nome}</strong>
          {e.nif && <div>NIF {e.nif}</div>}
          {e.endereco && <div>{e.endereco}</div>}
          {(e.telefone || e.email) && <div>{[e.telefone, e.email].filter(Boolean).join(' · ')}</div>}
        </div>
        <div className={estilo.docTitulo}>
          <h3>{doc.tipoNome}</h3>
          <div className={estilo.docNumero}>{doc.numero}</div>
          <div>{dataHora(doc.dataEmissao)}</div>
        </div>
      </div>

      <div className={estilo.docBloco}>
        <div>
          <div className={estilo.docRotulo}>Cliente</div>
          <strong>{doc.cliente ? doc.cliente.nome : 'Consumidor final'}</strong>
          {doc.cliente && doc.cliente.nif && <div>NIF {doc.cliente.nif}</div>}
          {doc.cliente && doc.cliente.endereco && <div>{doc.cliente.endereco}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={estilo.docRotulo}>Operador</div>
          {doc.emitidaPor || '—'}
          {doc.dataVencimento && <div>Vencimento: {doc.dataVencimento.split('-').reverse().join('/')}</div>}
        </div>
      </div>

      {doc.origem && <div style={{ marginTop: 8 }}>Documento de origem: <strong>{doc.origem.numero}</strong>{doc.motivoAnulacao ? `. Motivo: ${doc.motivoAnulacao}` : ''}</div>}
      {doc.notas.length > 0 && doc.tipo !== 'NC' && (
        <div style={{ marginTop: 8 }}>Anulado pela nota de crédito: <strong>{doc.notas.map((x) => x.numero).join(', ')}</strong></div>
      )}

      <table className={estilo.docTabela}>
        <thead>
          <tr>
            <th>Descrição</th>
            <th className={estilo.dir}>Qtd</th>
            <th className={estilo.dir}>Preço</th>
            <th className={estilo.dir}>Desc.</th>
            <th className={estilo.dir}>IVA</th>
            <th className={estilo.dir}>Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.itens.map((i) => (
            <tr key={i.id}>
              <td>{i.descricao}</td>
              <td className={estilo.dir}>{n(i.quantidade)}</td>
              <td className={estilo.dir}>{kz(i.precoUnitario)}</td>
              <td className={estilo.dir}>{i.desconto > 0 ? kz(i.desconto) : '—'}</td>
              <td className={estilo.dir}>{n(i.ivaPercentagem)}%</td>
              <td className={estilo.dir}>{kz(i.totalLinha)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className={estilo.docIva}>
        <thead>
          <tr><th>Taxa de IVA</th><th>Incidência</th><th>IVA</th></tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.percentagem}>
              <td>{n(g.percentagem)}%</td>
              <td>{kz(deCentimos(g.base))}</td>
              <td>{kz(deCentimos(g.iva))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={estilo.docTotais}>
        <div><span>Total sem IVA</span><span>{kz(doc.subtotal)}</span></div>
        {doc.descontoTotal > 0 && <div><span>Descontos</span><span>{kz(doc.descontoTotal)}</span></div>}
        <div><span>IVA</span><span>{kz(doc.ivaTotal)}</span></div>
        <div className={estilo.docTotalFinal}><span>Total</span><span>{kz(doc.total)}</span></div>
        {doc.pagamentos.map((p) => (
          <div key={p.id}><span>{p.metodo}</span><span>{kz(p.valor)}</span></div>
        ))}
        {troco > 0 && <div><span>Troco</span><span>{kz(troco)}</span></div>}
        {doc.saldo > 0 && <div><strong>Em dívida</strong><strong>{kz(doc.saldo)}</strong></div>}
      </div>

      {doc.observacoes && !doc.origem && <div style={{ marginTop: 10 }}>{doc.observacoes}</div>}

      <div className={estilo.docRodape}>
        <div>Controlo: {doc.hash ? doc.hash.slice(0, 4) : '—'} · Processado por {doc.programa.nome} v{doc.programa.versao}</div>
        {certificado
          ? <div>Software validado pela AGT n.º {certificado}</div>
          : <div className={estilo.docAviso}>Documento sem valor fiscal: software ainda não validado pela AGT.</div>}
      </div>
    </article>
  )
}

/**
 * Janela com o documento + ações (imprimir, receber, anular).
 * aoAtualizar(doc): chamado depois de receber ou anular, com o documento já atualizado.
 */
export default function Documento({ doc, troco = 0, podeAnular, aoFechar, aoAtualizar, aoNovaVenda }) {
  const [formato, setFormato] = useState('A4')
  const [acao, setAcao] = useState(null) // 'pagar' | 'anular' | null
  const [metodos, setMetodos] = useState([])
  const [pag, setPag] = useState({ metodoId: '', valor: '', referencia: '' })
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [trocoRecebido, setTrocoRecebido] = useState(0)

  const podePagar = doc.saldo > 0
  const podeAnularEste = podeAnular && ['FT', 'FR'].includes(doc.tipo) && ['emitida', 'paga', 'parcial'].includes(doc.estado)

  useEffect(() => {
    if (acao !== 'pagar' || metodos.length) return
    pedir('/api/definicoes/metodos-pagamento')
      .then((d) => {
        setMetodos(d.metodos)
        setPag((p) => ({ ...p, metodoId: d.metodos[0] ? String(d.metodos[0].id) : '' }))
      })
      .catch((e) => setErro(e.message))
  }, [acao, metodos.length])

  const abrir = (qual) => {
    setErro('')
    setAcao(acao === qual ? null : qual)
    if (qual === 'pagar') setPag((p) => ({ ...p, valor: String(doc.saldo.toFixed(2)) }))
  }

  const receber = async () => {
    setErro('')
    setATrabalhar(true)
    try {
      const d = await pedir(`/api/faturacao/documentos/${doc.id}/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagamentos: [{ metodoId: Number(pag.metodoId), valor: Number(String(pag.valor).replace(',', '.')), referencia: pag.referencia }],
        }),
      })
      setTrocoRecebido(d.troco || 0)
      setAcao(null)
      aoAtualizar(d.documento)
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  const anular = async () => {
    setErro('')
    setATrabalhar(true)
    try {
      const d = await pedir(`/api/faturacao/documentos/${doc.id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      setAcao(null)
      setMotivo('')
      aoAtualizar(d.documento)
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  const trocoMostrado = troco || trocoRecebido

  return (
    <Modal aberto titulo={`${doc.tipoNome} ${doc.numero}`} aoFechar={aoFechar}>
      {trocoMostrado > 0 && (
        <div className={estilo.painelAcao} style={{ background: '#e8f8e9' }} role="status">
          <strong>Troco a devolver: {kz(trocoMostrado)}</strong>
        </div>
      )}

      <div className={estilo.acoesDoc}>
        <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} onClick={() => window.print()}>
          <Printer size={16} />&nbsp;Imprimir
        </button>
        <select className={estilo.select} style={{ width: 'auto' }} aria-label="Formato de impressão" value={formato} onChange={(e) => setFormato(e.target.value)}>
          <option value="A4">Papel A4</option>
          <option value="80">Talão 80 mm</option>
        </select>
        {podePagar && (
          <button type="button" className={modal.btn} onClick={() => abrir('pagar')}>
            <Wallet size={16} />&nbsp;Receber pagamento
          </button>
        )}
        {podeAnularEste && (
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} onClick={() => abrir('anular')}>
            <Ban size={16} />&nbsp;Anular
          </button>
        )}
        <span className={estilo.espaco} />
        <span style={{ fontSize: 13, color: '#4b5563' }}>{ESTADOS[doc.estado]}</span>
        {aoNovaVenda && (
          <button type="button" className={modal.btn} onClick={aoNovaVenda}>Nova venda</button>
        )}
      </div>

      {erro && <div className={modal.erro} role="alert" style={{ margin: '12px 24px 0' }}>{erro}</div>}

      {acao === 'pagar' && (
        <div className={estilo.painelAcao}>
          <p style={{ margin: '0 0 10px' }}>Em dívida: <strong>{kz(doc.saldo)}</strong></p>
          <div className={estilo.pagamento} style={{ gridTemplateColumns: 'minmax(0,1fr) 130px' }}>
            <select className={estilo.select} aria-label="Método de pagamento" value={pag.metodoId} onChange={(e) => setPag((p) => ({ ...p, metodoId: e.target.value }))}>
              {metodos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <input className={estilo.campoCurto} inputMode="decimal" aria-label="Valor recebido" value={pag.valor} onChange={(e) => setPag((p) => ({ ...p, valor: e.target.value }))} />
            <input className={`${estilo.campoCurto} ${estilo.referencia}`} placeholder="Referência (opcional)" maxLength={100} value={pag.referencia} onChange={(e) => setPag((p) => ({ ...p, referencia: e.target.value }))} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} disabled={aTrabalhar || !pag.metodoId} onClick={receber}>
              {aTrabalhar ? 'A registar...' : 'Registar pagamento'}
            </button>
            <button type="button" className={modal.btn} onClick={() => setAcao(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {acao === 'anular' && (
        <div className={estilo.painelAcao}>
          <p style={{ margin: '0 0 8px' }}>
            Vai ser emitida uma <strong>nota de crédito</strong> que anula este documento e devolve os produtos ao stock. Não é possível desfazer.
          </p>
          <textarea aria-label="Motivo da anulação" placeholder="Motivo da anulação (obrigatório)" maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} disabled={aTrabalhar || motivo.trim().length < 3} onClick={anular}>
              {aTrabalhar ? 'A anular...' : 'Confirmar anulação'}
            </button>
            <button type="button" className={modal.btn} onClick={() => setAcao(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className={estilo.folha}>
        <Folha doc={doc} formato={formato === '80' ? '80' : 'A4'} troco={trocoMostrado} />
      </div>

      {/* cópia só para o papel: ao imprimir, tudo o resto da página fica escondido */}
      {createPortal(
        <div className={estilo.portalImpressao}>
          <Folha doc={doc} formato={formato === '80' ? '80' : 'A4'} troco={trocoMostrado} />
        </div>,
        document.body,
      )}
    </Modal>
  )
}
