import style from './Login.module.css'
import barra from './Planilha.module.css' // ajuste o caminho se precisar
import { useState, useEffect } from 'react'
import {
  PlusCircle,
  Printer,
  ListOrdered,
  Edit,
  Trash,
  Search,
  TrendingUp,
  TrendingDown,
  QrCode
} from 'lucide-react'
import Modal from './Modal'
import modal from './Modal.module.css'
import ModalProduto from './ModalProduto'
import ModalCategoria from './ModalCategoria'
import ModalFornecedor from './ModalFornecedor'
import EtiquetasQR from './EtiquetasQR'
import { pedir } from './api'

// tira acentos e maiúsculas para a pesquisa ("jose" encontra "José")
const normalizar = (t = '') =>
  String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const formatarPreco = (valor = 0) =>
  Number(valor).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })

// stock baixo: quantidade igual ou abaixo do stock mínimo do produto
const stockBaixo = (p) => p.quantidade <= p.stockMinimo

// miniatura da foto / do QR; se não existir (ou falhar a carregar) mostra uma caixa de reserva
function Miniatura({ src, alt, vazio = '', ajuste = 'cover', titleVazio }) {
  const [falhou, setFalhou] = useState(false)
  const caixa = { width: 44, height: 44, borderRadius: 8, flexShrink: 0 }

  if (!src || falhou) {
    return (
      <div
        title={titleVazio}
        style={{
          ...caixa,
          background: '#e6e6e6',
          color: '#6b6b6b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {vazio}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFalhou(true)}
      style={{ ...caixa, objectFit: ajuste, background: '#fff' }}
    />
  )
}

export default function Pagina() {
  // lista de produtos (vem da API /api/produtos)
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState(null) // null | 'asc' | 'desc' (por quantidade)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0) // aumenta para voltar a pedir à API

  // modais: null = fechado
  const [modalProduto, setModalProduto] = useState(null) // { id: null } = novo | { id: 3 } = editar
  const [modalCategoria, setModalCategoria] = useState(false)
  const [modalFornecedor, setModalFornecedor] = useState(false)
  const [etiquetas, setEtiquetas] = useState(null) // produtos para imprimir etiquetas com QR Code

  // confirmação de eliminar produto
  const [produtoApagar, setProdutoApagar] = useState(null)
  const [erroApagar, setErroApagar] = useState('')
  const [apagando, setApagando] = useState(false)

  const tarefas = true

  const recarregar = () => setTentativa((n) => n + 1)

  // carrega os produtos reais do backend
  useEffect(() => {
    const controlador = new AbortController()
    setCarregandoLista(true)
    setErro(false)

    pedir('/api/produtos?limite=200', { signal: controlador.signal })
      .then((dados) => {
        setProdutos(dados.produtos)
        setCarregandoLista(false)
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(true)
        setCarregandoLista(false)
      })

    return () => controlador.abort()
  }, [tentativa])

  const confirmarApagar = async () => {
    setApagando(true)
    setErroApagar('')
    try {
      await pedir(`/api/produtos/${produtoApagar.id}`, { method: 'DELETE' })
      setProdutoApagar(null)
      recarregar()
    } catch (e) {
      setErroApagar(e.message)
    } finally {
      setApagando(false)
    }
  }

  // pesquisa em vários campos
  const termo = normalizar(busca.trim())
  const encontrados = termo
    ? produtos.filter((p) =>
        normalizar(`${p.nome} ${p.categoria} ${p.fornecedor}`).includes(termo)
      )
    : produtos

  // ordenação por quantidade (botão "Ordenar" alterna: sem ordem → crescente → decrescente)
  const filtrados = ordem
    ? [...encontrados].sort((a, b) =>
        ordem === 'asc' ? a.quantidade - b.quantidade : b.quantidade - a.quantidade
      )
    : encontrados

  const alternarOrdem = () =>
    setOrdem((o) => (o === null ? 'asc' : o === 'asc' ? 'desc' : null))

  const totalBaixo = produtos.filter(stockBaixo).length

  // só mostra "A carregar" quando ainda não há nada na tabela (evita piscar depois de guardar)
  const aCarregarInicial = carregandoLista && produtos.length === 0

  return (
    <div className={style.conteudo}>
      <main className={style.pagina}>

        <div className={barra.barra}>

          {/* Inserir */}
          <div className={barra.grupo}>
            <button type="button" className={barra.botao} onClick={() => setModalProduto({ id: null })}>
              <PlusCircle color='black' size={18} /> Inserir Produto
            </button>
          </div>

          {/* Ações: só aparecem quando existe tarefa */}
          {tarefas && (
            <>
              <span className={barra.divisor} />
              <div className={barra.grupo}>
                <button type="button" className={barra.botao} title="Inserir categoria" onClick={() => setModalCategoria(true)}>
                  <PlusCircle color='black' size={18} /> Inserir categoria
                </button>
                <button type="button" className={barra.botao} title="Inserir fornecedor" onClick={() => setModalFornecedor(true)}>
                  <PlusCircle color='black' size={18} /> Inserir fornecedor
                </button>
                <button type="button" className={barra.botao} title="Imprimir" onClick={() => window.print()}>
                  <Printer color='black' size={18} /> Imprimir
                </button>
                <button type="button" className={barra.botao} title="Imprimir etiquetas com QR Code" onClick={() => setEtiquetas(filtrados)}>
                  <QrCode color='black' size={18} /> Etiquetas QR
                </button>
                <button
                  type="button"
                  className={`${barra.botao} ${barra.perigo}`}
                  title="Ordenar por quantidade"
                  onClick={alternarOrdem}
                >
                  <ListOrdered color='black' size={18} /> Ordenar
                  {ordem === 'asc' && ' ↑'}
                  {ordem === 'desc' && ' ↓'}
                </button>
              </div>
            </>
          )}

        </div>

        <div className={barra.divInput} style={{ position: 'relative' }}>
          <Search
            size={18}
            color="#6b6b6b"
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="pesquisar produto, categoria ou fornecedor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ paddingLeft: 44 }}
          />
        </div>

      </main>

      <div className={style.tabelaWrap}>
        <table className={style.table}>

          <thead>
            <tr>
              <th>ID</th>
              <th>Foto</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Preço</th>
              <th>Quantidade</th>
              <th>QR Code</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {aCarregarInicial && (
              <tr>
                <td colSpan={9} className={style.vazio}>A carregar produtos...</td>
              </tr>
            )}

            {!carregandoLista && erro && (
              <tr>
                <td colSpan={9} className={style.vazio}>
                  Não foi possível carregar os produtos.{' '}
                  <button type="button" className={style.linkBtn} onClick={recarregar}>
                    Tentar novamente
                  </button>
                </td>
              </tr>
            )}

            {!carregandoLista && !erro && filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className={style.vazio}>
                  {termo ? (
                    <>
                      Nenhum resultado para “{busca}”.{' '}
                      <button type="button" className={style.linkBtn} onClick={() => setBusca('')}>
                        Limpar pesquisa
                      </button>
                    </>
                  ) : (
                    <>
                      Ainda não há produtos.{' '}
                      <button type="button" className={style.linkBtn} onClick={() => setModalProduto({ id: null })}>
                        Adicionar o primeiro
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}

            {!aCarregarInicial && !erro && filtrados.map((u) => {
              const baixo = stockBaixo(u)
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>

                  <td>
                    <Miniatura
                      src={u.foto}
                      alt={u.nome}
                      vazio={u.nome.charAt(0).toUpperCase()}
                      titleVazio="Sem foto"
                    />
                  </td>

                  <td>
                    <div className={style.nomeCelula}>{u.nome}</div>
                  </td>

                  <td>{u.categoria}</td>
                  <td>{u.fornecedor}</td>
                  <td>{formatarPreco(u.preco)}</td>

                  <td>
                    <span
                      className={style.quantidade}
                      title={baixo ? `Stock baixo (mínimo: ${u.stockMinimo})` : 'Stock em dia'}
                    >
                      {baixo
                        ? <TrendingDown size={18} color="red" />
                        : <TrendingUp size={18} color="green" />}
                      {u.quantidade}
                    </span>
                  </td>

                  <td>
                    <Miniatura
                      src={u.qrImagem}
                      alt={`QR Code de ${u.nome}`}
                      ajuste="contain"
                      vazio="—"
                      titleVazio="QR Code ainda não gerado"
                    />
                  </td>

                  <td>
                    <div className={style.acoes}>

                      <button
                        type="button"
                        className={style.iconBtn}
                        aria-label={`Imprimir etiqueta QR de ${u.nome}`}
                        title="Imprimir etiqueta QR"
                        onClick={() => setEtiquetas([u])}
                      >
                        <QrCode size={18} className={style.icon} color="#2acd2d" />
                      </button>

                      <button
                        type="button"
                        className={`${style.iconBtn} ${style.editar}`}
                        aria-label={`Editar ${u.nome}`}
                        title="Editar"
                        onClick={() => setModalProduto({ id: u.id })}
                      >
                      <Edit size={18} className={style.icon} color="#2acd2d" />
                      </button>

                      <button
                        type="button"
                        className={`${style.iconBtn} ${style.apagar}`}
                        aria-label={`Eliminar ${u.nome}`}
                        title="Eliminar"
                        onClick={(e) => {
                          e.preventDefault()
                          setErroApagar('')
                          setProdutoApagar(u)
                        }}
                      >
                      <Trash size={18} className={style.icon} color="#2acd2d" />
                      </button>

                    </div>
                  </td>
                </tr>
              )
            })}

          </tbody>
        </table>
      </div>

      {/* Modais */}
      <ModalProduto
        aberto={!!modalProduto}
        produtoId={modalProduto ? modalProduto.id : null}
        aoFechar={() => setModalProduto(null)}
        aoGuardar={recarregar}
      />

      <ModalCategoria
        aberto={modalCategoria}
        aoFechar={() => setModalCategoria(false)}
        aoAlterar={recarregar}
      />

      <ModalFornecedor
        aberto={modalFornecedor}
        aoFechar={() => setModalFornecedor(false)}
        aoAlterar={recarregar}
      />

      {etiquetas && <EtiquetasQR produtos={etiquetas} aoFechar={() => setEtiquetas(null)} />}

      <Modal
        aberto={!!produtoApagar}
        titulo="Eliminar produto"
        aoFechar={() => setProdutoApagar(null)}
        estreita
      >
        <div className={modal.corpo}>
          {erroApagar && <div className={modal.erro} role="alert">{erroApagar}</div>}
          <p className={modal.texto} style={{color:'black'}}>
            Tens a certeza que queres eliminar <strong>{produtoApagar && produtoApagar.nome}</strong>?
            O produto deixa de aparecer na lista, mas as faturas já emitidas mantêm-se.
          </p>
        </div>
        <div className={modal.rodape}>
          <button type="button" className={modal.btn} onClick={() => setProdutoApagar(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${modal.btn} ${modal.btnPerigo}`}
            onClick={confirmarApagar}
            disabled={apagando}
          >
            {apagando ? 'A eliminar...' : 'Eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
