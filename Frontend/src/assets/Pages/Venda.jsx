import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Barcode, Minus, Plus, Trash } from 'lucide-react'
import estilo from './Faturacao.module.css'
import Documento from './Documento'
import ModalCliente from './ModalCliente'
import { pedir } from './api'
import { utilizadorAtual } from './sessao'
import { kz, n } from './formatar'
import { calcularLinha, somarDocumento, paraCentimos, deCentimos } from './calculos'

// ---- sinal sonoro: agudo = leu bem, grave = erro
let audio = null
function beep(ok = true) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    const osc = audio.createOscillator()
    const ganho = audio.createGain()
    osc.frequency.value = ok ? 880 : 200
    ganho.gain.value = 0.07
    osc.connect(ganho)
    ganho.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (ok ? 0.07 : 0.25))
  } catch { /* sem áudio: segue em silêncio */ }
}

let contador = 0
const novaLinhaPagamento = (metodoId = '') => ({ id: ++contador, metodoId: String(metodoId), valor: '', referencia: '', manual: false })
const lerValor = (v) => {
  const x = Number(String(v).replace(',', '.'))
  return Number.isFinite(x) && x > 0 ? x : 0
}
const pareceNome = (t) => /[a-zA-ZÀ-ÿ]/.test(t) && t.length >= 2 && !t.toUpperCase().startsWith('PROD:')

export default function Venda({ ativo }) {
  const eu = utilizadorAtual()
  const podeDesconto = ['admin', 'gestor'].includes(eu.perfil)
  const podeAnular = ['admin', 'gestor'].includes(eu.perfil)

  const [config, setConfig] = useState(null)
  const [metodos, setMetodos] = useState([])
  const [erroInicial, setErroInicial] = useState('')

  const [carrinho, setCarrinhoEstado] = useState([])
  const carrinhoRef = useRef([])
  const setCarrinho = (novo) => { carrinhoRef.current = novo; setCarrinhoEstado(novo) }

  const [tipo, setTipo] = useState('FR')
  const [cliente, setCliente] = useState(null) // null = consumidor final
  const [dias, setDias] = useState(30)
  const [pagamentos, setPagamentos] = useState([novaLinhaPagamento()])

  const [codigo, setCodigo] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [aviso, setAviso] = useState({ texto: '', ok: true })
  const leitor = useRef(null)

  const [emitindo, setEmitindo] = useState(false)
  const [erroEmissao, setErroEmissao] = useState('')
  const [emitido, setEmitido] = useState(null) // { doc, troco }
  const [escolherCliente, setEscolherCliente] = useState(false)

  // ---------------------------------------------------------------- arranque
  useEffect(() => {
    Promise.all([pedir('/api/faturacao/config'), pedir('/api/definicoes/metodos-pagamento')])
      .then(([c, m]) => {
        setConfig(c)
        setMetodos(m.metodos)
        setPagamentos([novaLinhaPagamento(m.metodos[0] ? m.metodos[0].id : '')])
      })
      .catch((e) => setErroInicial(e.message))
  }, [])

  const focar = () => { if (leitor.current) leitor.current.focus() }
  useEffect(() => { if (ativo && config) focar() }, [ativo, config])

  const dizer = (texto, ok = true) => { setAviso({ texto, ok }); beep(ok) }

  // ---------------------------------------------------------------- totais (pré-visualização)
  const precosComIva = config ? config.precosComIva : true
  const linhas = useMemo(() => carrinho.map((item) => {
    const precoCentimos = paraCentimos(item.preco)
    const bruto = item.quantidade * precoCentimos
    const descontoCentimos = Math.min(bruto, Math.round((bruto * (Number(item.descontoPct) || 0)) / 100))
    return {
      ...item,
      calculo: calcularLinha({
        quantidade: item.quantidade, precoCentimos, descontoCentimos, ivaPercentagem: item.ivaPercentagem, precosComIva,
      }),
    }
  }), [carrinho, precosComIva])

  const totais = useMemo(() => somarDocumento(linhas.map((l) => l.calculo)), [linhas])
  const total = totais.total

  const pagoCentimos = pagamentos.reduce((s, p) => s + paraCentimos(lerValor(p.valor)), 0)
  const falta = Math.max(total - pagoCentimos, 0)
  const troco = Math.max(pagoCentimos - total, 0)

  // se só há uma linha de pagamento e o utilizador não mexeu no valor, acompanha o total
  useEffect(() => {
    setPagamentos((lista) => (lista.length === 1 && !lista[0].manual
      ? [{ ...lista[0], valor: total > 0 ? String(deCentimos(total).toFixed(2)) : '' }]
      : lista))
  }, [total])

  // ---------------------------------------------------------------- carrinho
  const adicionar = (produto) => {
    const atual = carrinhoRef.current
    const existente = atual.find((i) => i.produtoId === produto.id)

    if (produto.stock <= 0) { dizer(`Sem stock: ${produto.nome}`, false); return }
    if (existente) {
      if (existente.quantidade + 1 > produto.stock) { dizer(`Stock máximo de "${produto.nome}": ${produto.stock}`, false); return }
      setCarrinho(atual.map((i) => (i.produtoId === produto.id ? { ...i, quantidade: i.quantidade + 1, stock: produto.stock } : i)))
    } else {
      setCarrinho([...atual, {
        produtoId: produto.id, nome: produto.nome, codigo: produto.codigoBarras || produto.codigo || '',
        unidade: produto.unidade, preco: produto.preco, ivaPercentagem: produto.ivaPercentagem,
        stock: produto.stock, quantidade: 1, descontoPct: 0,
      }])
    }
    dizer(`${produto.nome} adicionado`, true)
    setSugestoes([])
  }

  const mudarQuantidade = (produtoId, valor) => {
    setCarrinho(carrinhoRef.current.map((i) => {
      if (i.produtoId !== produtoId) return i
      const q = Math.floor(Number(valor)) || 1
      if (q > i.stock) { dizer(`Stock máximo de "${i.nome}": ${i.stock}`, false) }
      return { ...i, quantidade: Math.min(Math.max(q, 1), i.stock) }
    }))
  }

  const mudarDesconto = (produtoId, valor) => {
    const pct = Math.min(Math.max(Number(String(valor).replace(',', '.')) || 0, 0), 100)
    setCarrinho(carrinhoRef.current.map((i) => (i.produtoId === produtoId ? { ...i, descontoPct: pct } : i)))
  }

  const remover = (produtoId) => {
    setCarrinho(carrinhoRef.current.filter((i) => i.produtoId !== produtoId))
    focar()
  }

  // ---------------------------------------------------------------- leitor de código de barras / QR
  // O leitor USB "escreve" o código e carrega em Enter, como um teclado muito rápido.
  const aoLer = async (texto) => {
    const c = texto.trim()
    if (!c) return
    setCodigo('')
    setSugestoes([])
    try {
      const d = await pedir(`/api/faturacao/produto?codigo=${encodeURIComponent(c)}`)
      adicionar(d.produto)
    } catch (e) {
      if (e.message !== 'Produto não encontrado.') { dizer(e.message, false); return }
      if (!pareceNome(c)) { dizer(`Produto não encontrado: ${c}`, false); return }
      // não era um código: tenta como nome
      try {
        const d = await pedir(`/api/faturacao/produtos?busca=${encodeURIComponent(c)}`)
        if (d.produtos.length === 1) adicionar(d.produtos[0])
        else if (d.produtos.length > 1) { setCodigo(c); setSugestoes(d.produtos); setAviso({ texto: 'Escolha o produto na lista', ok: true }) }
        else dizer(`Produto não encontrado: ${c}`, false)
      } catch (err) { dizer(err.message, false) }
    }
    focar()
  }

  // sugestões enquanto se escreve um nome (um código lido pelo leitor nunca chega a disparar isto)
  useEffect(() => {
    if (!pareceNome(codigo)) { setSugestoes([]); return undefined }
    const controlador = new AbortController()
    const espera = setTimeout(() => {
      pedir(`/api/faturacao/produtos?busca=${encodeURIComponent(codigo.trim())}`, { signal: controlador.signal })
        .then((d) => setSugestoes(d.produtos))
        .catch(() => {})
    }, 250)
    return () => { clearTimeout(espera); controlador.abort() }
  }, [codigo])

  // ---------------------------------------------------------------- pagamentos
  const mudarPagamento = (id, campo, valor) =>
    setPagamentos((l) => l.map((p) => (p.id === id ? { ...p, [campo]: valor, manual: campo === 'valor' ? true : p.manual } : p)))

  const adicionarPagamento = () =>
    setPagamentos((l) => [...l, { ...novaLinhaPagamento(metodos[0] ? metodos[0].id : ''), manual: true, valor: falta > 0 ? String(deCentimos(falta).toFixed(2)) : '' }])

  const removerPagamento = (id) => setPagamentos((l) => (l.length > 1 ? l.filter((p) => p.id !== id) : l))

  // ---------------------------------------------------------------- emitir
  const falhaCliente = tipo === 'FT' && (!cliente || !cliente.nif)
  const podeEmitir = Boolean(config && config.empresaConfigurada) && carrinho.length > 0 && !emitindo
    && (tipo === 'FT' ? !falhaCliente : total > 0 && pagoCentimos >= total)

  const emitir = async () => {
    if (!podeEmitir) return
    setErroEmissao('')
    setEmitindo(true)
    try {
      const corpo = {
        tipo,
        clienteId: cliente ? cliente.id : null,
        diasVencimento: dias,
        itens: linhas.map((l) => ({ produtoId: l.produtoId, quantidade: l.quantidade, desconto: deCentimos(l.calculo.desconto) })),
        pagamentos: tipo === 'FR'
          ? pagamentos.filter((p) => lerValor(p.valor) > 0).map((p) => ({ metodoId: Number(p.metodoId), valor: lerValor(p.valor), referencia: p.referencia }))
          : [],
      }
      const d = await pedir('/api/faturacao/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      beep(true)
      setEmitido({ doc: d.documento, troco: d.troco })
    } catch (e) {
      setErroEmissao(e.message)
      beep(false)
    } finally {
      setEmitindo(false)
    }
  }

  const emitirRef = useRef(emitir)
  emitirRef.current = emitir

  const novaVenda = () => {
    setCarrinho([])
    setTipo('FR')
    setCliente(null)
    setDias(30)
    setPagamentos([novaLinhaPagamento(metodos[0] ? metodos[0].id : '')])
    setErroEmissao('')
    setAviso({ texto: '', ok: true })
    setEmitido(null)
    setTimeout(focar, 50)
  }

  // ---------------------------------------------------------------- atalhos globais
  useEffect(() => {
    if (!ativo) return undefined
    const aoTeclar = (e) => {
      if (emitido || escolherCliente) return
      if (e.key === 'F2') { e.preventDefault(); focar(); return }
      if (e.key === 'F9') { e.preventDefault(); emitirRef.current(); return }
      // o leitor escreveu sem o campo estar em foco: não perder o primeiro caracter
      const alvo = e.target
      const aEscrever = alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
      if (!aEscrever && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && leitor.current) {
        e.preventDefault()
        leitor.current.focus()
        setCodigo((c) => c + e.key)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ativo, emitido, escolherCliente])

  // ---------------------------------------------------------------- ecrã
  if (erroInicial) return <p className={estilo.mensagem} role="alert">{erroInicial}</p>
  if (!config) return <p className={estilo.mensagem}>A preparar o ecrã de venda...</p>

  const nomeCliente = cliente ? cliente.nome : config.consumidorFinal.nome

  return (
    <div className={estilo.venda}>
      {/* ------------------------------------------------ esquerda: leitor e produtos */}
      <section aria-label="Produtos da venda">
        {!config.empresaConfigurada && (
          <div className={estilo.avisoErro} role="alert" style={{ marginBottom: 10 }}>
            Falta preencher os dados da empresa. <Link to="/Def">Abrir Definições</Link>
          </div>
        )}

        <div className={estilo.leitor}>
          <Barcode className={estilo.leitorIcone} size={24} aria-hidden="true" />
          <input
            ref={leitor}
            className={estilo.leitorInput}
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-label="Ler código de barras, QR Code ou pesquisar produto pelo nome"
            placeholder="Passe o leitor no produto ou escreva o nome"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); aoLer(codigo) }
              if (e.key === 'Escape') { setCodigo(''); setSugestoes([]) }
            }}
          />
          <span className={estilo.atalhos} aria-hidden="true">
            <kbd className={estilo.tecla}>F2</kbd>
          </span>

          {sugestoes.length > 0 && (
            <ul className={estilo.sugestoes} role="listbox" aria-label="Produtos encontrados">
              {sugestoes.map((p) => (
                <li key={p.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    className={estilo.sugestao}
                    disabled={p.stock <= 0}
                    onClick={() => { adicionar(p); setCodigo(''); focar() }}
                  >
                    <span className={estilo.sugestaoNome}>
                      {p.nome}
                      <span className={estilo.sugestaoSub}>
                        {p.codigoBarras || p.codigo || 'sem código'} · {p.stock > 0 ? `${p.stock} em stock` : 'sem stock'}
                      </span>
                    </span>
                    <span className={estilo.sugestaoPreco}>{kz(p.preco)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${estilo.aviso} ${aviso.ok ? estilo.avisoOk : estilo.avisoErro}`} role="status" aria-live="polite">
          {aviso.texto}
        </div>

        <div className={estilo.carrinho}>
          {linhas.length === 0 ? (
            <div className={estilo.vazioCarrinho}>
              <strong>Nenhum produto na venda</strong>
              Passe o leitor no código de barras ou no QR Code do produto.
            </div>
          ) : (
            <table className={estilo.linhas}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th className={estilo.num}>Preço</th>
                  {podeDesconto && <th className={estilo.num}>Desc. %</th>}
                  <th className={estilo.num}>IVA</th>
                  <th className={estilo.num}>Total</th>
                  <th><span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Remover</span></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.produtoId}>
                    <td className={estilo.produtoNome}>
                      {l.nome}
                      <span className={estilo.produtoSub}>
                        {l.codigo}{l.codigo ? ' · ' : ''}
                        <span className={l.stock - l.quantidade <= 0 ? estilo.stockBaixo : ''}>{l.stock} em stock</span>
                      </span>
                    </td>
                    <td>
                      <div className={estilo.quantidade}>
                        <button type="button" aria-label={`Menos um ${l.nome}`} disabled={l.quantidade <= 1} onClick={() => mudarQuantidade(l.produtoId, l.quantidade - 1)}><Minus size={14} /></button>
                        <input
                          type="number" min="1" max={l.stock} aria-label={`Quantidade de ${l.nome}`}
                          value={l.quantidade}
                          onChange={(e) => mudarQuantidade(l.produtoId, e.target.value)}
                        />
                        <button type="button" aria-label={`Mais um ${l.nome}`} disabled={l.quantidade >= l.stock} onClick={() => mudarQuantidade(l.produtoId, l.quantidade + 1)}><Plus size={14} /></button>
                      </div>
                    </td>
                    <td className={estilo.num}>{kz(l.preco)}</td>
                    {podeDesconto && (
                      <td className={estilo.num}>
                        <input
                          className={estilo.desconto} inputMode="decimal" aria-label={`Desconto em % de ${l.nome}`}
                          value={l.descontoPct || ''} placeholder="0"
                          onChange={(e) => mudarDesconto(l.produtoId, e.target.value)}
                        />
                      </td>
                    )}
                    <td className={estilo.num}>{n(l.ivaPercentagem)}%</td>
                    <td className={`${estilo.num} ${estilo.produtoNome}`}>{kz(deCentimos(l.calculo.totalLinha))}</td>
                    <td>
                      <button type="button" className={estilo.remover} aria-label={`Remover ${l.nome}`} onClick={() => remover(l.produtoId)}><Trash size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ direita: cliente, total e pagamento */}
      <aside className={estilo.resumo} aria-label="Resumo e pagamento">
        <div className={estilo.bloco}>
          <span className={estilo.rotulo}>Documento</span>
          <div className={estilo.tipos} role="group" aria-label="Tipo de documento">
            <button type="button" className={`${estilo.tipo} ${tipo === 'FR' ? estilo.tipoAtivo : ''}`} aria-pressed={tipo === 'FR'} onClick={() => setTipo('FR')}>Fatura-Recibo</button>
            <button type="button" className={`${estilo.tipo} ${tipo === 'FT' ? estilo.tipoAtivo : ''}`} aria-pressed={tipo === 'FT'} onClick={() => setTipo('FT')}>Fatura (a crédito)</button>
          </div>
        </div>

        <div className={estilo.bloco}>
          <span className={estilo.rotulo}>Cliente</span>
          <div className={estilo.cliente}>
            <span className={estilo.clienteNome}>
              {nomeCliente}
              <span className={estilo.clienteNif}>{cliente ? (cliente.nif ? `NIF ${cliente.nif}` : 'Sem NIF') : 'Sem identificação'}</span>
            </span>
            <button type="button" className={estilo.ligacao} onClick={() => setEscolherCliente(true)}>Alterar</button>
          </div>
          {falhaCliente && <p className={estilo.avisoErro} style={{ margin: '8px 0 0', fontSize: 13 }}>A fatura a crédito precisa de um cliente com NIF.</p>}
        </div>

        <div className={estilo.bloco}>
          <div className={estilo.linhaTotal}><span>Total sem IVA</span><span>{kz(deCentimos(totais.subtotal))}</span></div>
          {totais.descontoTotal > 0 && <div className={estilo.linhaTotal}><span>Descontos</span><span>{kz(deCentimos(totais.descontoTotal))}</span></div>}
          <div className={estilo.linhaTotal}><span>IVA</span><span>{kz(deCentimos(totais.iva))}</span></div>
          <div className={estilo.total}>
            <span className={estilo.rotulo} style={{ margin: 0 }}>Total a pagar</span>
            <span className={estilo.totalValor}>{kz(deCentimos(total))}</span>
          </div>
        </div>

        {tipo === 'FR' ? (
          <div className={estilo.bloco}>
            <span className={estilo.rotulo}>Pagamento</span>
            <div className={estilo.pagamentos}>
              {pagamentos.map((p, i) => (
                <div key={p.id} className={estilo.pagamento}>
                  <select className={estilo.select} aria-label="Método de pagamento" value={p.metodoId} onChange={(e) => mudarPagamento(p.id, 'metodoId', e.target.value)}>
                    {metodos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  <input
                    className={estilo.campoCurto} inputMode="decimal" aria-label="Valor recebido" placeholder="0,00"
                    style={{ textAlign: 'right' }} value={p.valor}
                    onChange={(e) => mudarPagamento(p.id, 'valor', e.target.value)}
                  />
                  {pagamentos.length > 1 ? (
                    <button type="button" className={estilo.remover} aria-label={`Remover pagamento ${i + 1}`} onClick={() => removerPagamento(p.id)}><Trash size={16} /></button>
                  ) : <span />}
                  <input
                    className={`${estilo.campoCurto} ${estilo.referencia}`} placeholder="Referência (opcional)" maxLength={100}
                    value={p.referencia} onChange={(e) => mudarPagamento(p.id, 'referencia', e.target.value)}
                  />
                </div>
              ))}
              <button type="button" className={estilo.ligacao} onClick={adicionarPagamento}>+ Dividir o pagamento</button>
            </div>
            {total > 0 && troco > 0 && <div className={estilo.troco} role="status"><span>Troco</span><span>{kz(deCentimos(troco))}</span></div>}
            {total > 0 && falta > 0 && <div className={estilo.falta} role="status"><span>Falta receber</span><span>{kz(deCentimos(falta))}</span></div>}
          </div>
        ) : (
          <div className={estilo.bloco}>
            <span className={estilo.rotulo}>Vencimento</span>
            <label style={{ fontSize: 14 }}>
              Pagar em{' '}
              <input
                className={estilo.campoCurto} style={{ width: 70, display: 'inline-block', textAlign: 'right' }}
                type="number" min="0" max="365" value={dias}
                onChange={(e) => setDias(Math.min(Math.max(parseInt(e.target.value, 10) || 0, 0), 365))}
              />{' '}dias
            </label>
            <p className={estilo.ajuda} style={{ textAlign: 'left' }}>O pagamento regista-se depois, na lista de documentos.</p>
          </div>
        )}

        <div className={estilo.bloco}>
          {erroEmissao && <div className={estilo.avisoErro} role="alert" style={{ marginBottom: 10 }}>{erroEmissao}</div>}
          <button type="button" className={estilo.emitir} disabled={!podeEmitir} onClick={emitir}>
            {emitindo ? 'A emitir...' : tipo === 'FR' ? 'Emitir fatura-recibo' : 'Emitir fatura'}
          </button>
          <p className={estilo.ajuda}><kbd className={estilo.tecla}>F9</kbd> emitir · <kbd className={estilo.tecla}>F2</kbd> leitor</p>
        </div>
      </aside>

      {escolherCliente && (
        <ModalCliente
          consumidorFinal={config.consumidorFinal}
          aoFechar={() => { setEscolherCliente(false); focar() }}
          aoEscolher={(c) => { setCliente(c); setEscolherCliente(false); setTimeout(focar, 50) }}
        />
      )}

      {emitido && (
        <Documento
          doc={emitido.doc}
          troco={emitido.troco}
          podeAnular={podeAnular}
          aoFechar={novaVenda}
          aoNovaVenda={novaVenda}
          aoAtualizar={(doc) => setEmitido((e) => ({ ...e, doc }))}
        />
      )}
    </div>
  )
}
