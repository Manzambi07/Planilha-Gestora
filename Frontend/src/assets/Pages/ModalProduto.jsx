import { useEffect, useState } from 'react'
import Modal from './Modal'
import estilo from './Modal.module.css'
import { pedir } from './api'

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const LIMITE_FOTO = 2 * 1024 * 1024 // 2 MB (o servidor também valida)

const vazio = {
  nome: '',
  codigo: '',
  codigoBarras: '',
  descricao: '',
  categoriaId: '',
  fornecedorId: '',
  taxaIvaId: '',
  precoCusto: '',
  precoVenda: '',
  quantidade: '0',
  stockMinimo: '5',
  unidade: 'un',
}

// produtoId = null  -> inserir produto novo
// produtoId = número -> editar esse produto
export default function ModalProduto({ aberto, produtoId, aoFechar, aoGuardar }) {
  const editando = produtoId !== null && produtoId !== undefined

  const [opcoes, setOpcoes] = useState({ categorias: [], fornecedores: [], taxasIva: [] })
  const [valores, setValores] = useState(vazio)
  const [fotoAtual, setFotoAtual] = useState(null) // URL da foto já guardada
  const [qrAtual, setQrAtual] = useState(null)
  const [novaFoto, setNovaFoto] = useState(null) // ficheiro escolhido agora
  const [previewNova, setPreviewNova] = useState(null)
  const [removerFoto, setRemoverFoto] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  // ao abrir: carrega os selects e (se for editar) os dados do produto
  useEffect(() => {
    if (!aberto) return
    const controlador = new AbortController()
    const { signal } = controlador

    setErro('')
    setNovaFoto(null)
    setRemoverFoto(false)
    setFotoAtual(null)
    setQrAtual(null)
    setValores(vazio)
    setCarregando(true)

    const pedidos = [pedir('/api/produtos/opcoes', { signal })]
    if (editando) pedidos.push(pedir(`/api/produtos/${produtoId}`, { signal }))

    Promise.all(pedidos)
      .then(([ops, detalhe]) => {
        setOpcoes(ops)
        if (detalhe) {
          const p = detalhe.produto
          setValores({
            nome: p.nome ?? '',
            codigo: p.codigo ?? '',
            codigoBarras: p.codigoBarras ?? '',
            descricao: p.descricao ?? '',
            categoriaId: String(p.categoriaId ?? ''),
            fornecedorId: p.fornecedorId ? String(p.fornecedorId) : '',
            taxaIvaId: String(p.taxaIvaId ?? ''),
            precoCusto: String(p.precoCusto ?? ''),
            precoVenda: String(p.preco ?? ''),
            quantidade: String(p.quantidade ?? 0),
            stockMinimo: String(p.stockMinimo ?? 5),
            unidade: p.unidade ?? 'un',
          })
          setFotoAtual(p.foto)
          setQrAtual(p.qrImagem)
        } else {
          // produto novo: já vem com o primeiro IVA selecionado (IVA 14%)
          setValores((v) => ({
            ...v,
            taxaIvaId: ops.taxasIva[0] ? String(ops.taxasIva[0].id) : '',
          }))
        }
        setCarregando(false)
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })

    return () => controlador.abort()
  }, [aberto, produtoId])

  // pré-visualização da foto escolhida
  useEffect(() => {
    if (!novaFoto) {
      setPreviewNova(null)
      return
    }
    const url = URL.createObjectURL(novaFoto)
    setPreviewNova(url)
    return () => URL.revokeObjectURL(url)
  }, [novaFoto])

  const campo = (nome) => ({
    value: valores[nome],
    onChange: (e) => setValores((v) => ({ ...v, [nome]: e.target.value })),
  })

  const aoEscolherFoto = (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = '' // permite escolher o mesmo ficheiro outra vez
    if (!f) return
    if (!TIPOS_FOTO.includes(f.type)) return setErro('A foto deve ser JPG, PNG ou WEBP.')
    if (f.size > LIMITE_FOTO) return setErro('A foto não pode ter mais de 2 MB.')
    setErro('')
    setNovaFoto(f)
    setRemoverFoto(false)
  }

  const tirarFoto = () => {
    if (novaFoto) setNovaFoto(null)
    else setRemoverFoto(true)
  }

  const fotoMostrada = previewNova || (removerFoto ? null : fotoAtual)

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setAGuardar(true)
    try {
      const dados = new FormData()
      Object.entries(valores).forEach(([k, v]) => dados.append(k, v))
      if (novaFoto) dados.append('foto', novaFoto)
      if (removerFoto && !novaFoto) dados.append('removerFoto', '1')

      await pedir(editando ? `/api/produtos/${produtoId}` : '/api/produtos', {
        method: editando ? 'PUT' : 'POST',
        body: dados, // sem Content-Type: o browser acrescenta o correto
      })
      aoGuardar()
      aoFechar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <Modal aberto={aberto} titulo={editando ? 'Editar produto' : 'Inserir produto'} aoFechar={aoFechar}>
      <form className={estilo.formulario} onSubmit={enviar}>
        <div className={estilo.corpo}>
          {erro && <div className={estilo.erro} role="alert">{erro}</div>}

          <div className={estilo.grade}>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label htmlFor="prod-nome">Nome <span className={estilo.obrigatorio}>*</span></label>
              <input id="prod-nome" type="text" maxLength={150} required {...campo('nome')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-categoria">Categoria <span className={estilo.obrigatorio}>*</span></label>
              <select id="prod-categoria" required {...campo('categoriaId')}>
                <option value="">Selecionar...</option>
                {opcoes.categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-fornecedor">Fornecedor</label>
              <select id="prod-fornecedor" {...campo('fornecedorId')}>
                <option value="">Sem fornecedor</option>
                {opcoes.fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-custo">Preço de custo (Kz)</label>
              <input id="prod-custo" type="number" min="0" step="0.01" {...campo('precoCusto')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-venda">Preço de venda (Kz) <span className={estilo.obrigatorio}>*</span></label>
              <input id="prod-venda" type="number" min="0" step="0.01" required {...campo('precoVenda')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-iva">IVA <span className={estilo.obrigatorio}>*</span></label>
              <select id="prod-iva" required {...campo('taxaIvaId')}>
                <option value="">Selecionar...</option>
                {opcoes.taxasIva.map((t) => (
                  <option key={t.id} value={t.id}>{t.descricao}</option>
                ))}
              </select>
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-unidade">Unidade</label>
              <input id="prod-unidade" type="text" maxLength={15} placeholder="un, kg, l, cx..." {...campo('unidade')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-qtd">Quantidade em stock <span className={estilo.obrigatorio}>*</span></label>
              <input id="prod-qtd" type="number" min="0" step="1" required {...campo('quantidade')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-min">Stock mínimo</label>
              <input id="prod-min" type="number" min="0" step="1" {...campo('stockMinimo')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-codigo">Código interno</label>
              <input id="prod-codigo" type="text" maxLength={40} {...campo('codigo')} />
            </div>

            <div className={estilo.campo}>
              <label htmlFor="prod-barras">Código de barras</label>
              <input id="prod-barras" type="text" maxLength={40} {...campo('codigoBarras')} />
            </div>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label htmlFor="prod-descricao">Descrição</label>
              <textarea id="prod-descricao" maxLength={2000} {...campo('descricao')} />
            </div>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label>Foto</label>
              <div className={estilo.fotoLinha}>
                {fotoMostrada ? (
                  <img className={estilo.preview} src={fotoMostrada} alt="Foto do produto" />
                ) : (
                  <div className={estilo.previewVazio}>Sem foto</div>
                )}
                <div>
                  <div className={estilo.fotoAcoes}>
                    <label className={`${estilo.btn} ${estilo.btnPequeno}`}>
                      {fotoMostrada ? 'Trocar foto' : 'Escolher foto'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={aoEscolherFoto}
                      />
                    </label>
                    {fotoMostrada && (
                      <button type="button" className={`${estilo.btn} ${estilo.btnPequeno}`} onClick={tirarFoto}>
                        Remover
                      </button>
                    )}
                  </div>
                  <p className={estilo.dica}>JPG, PNG ou WEBP, até 2 MB.</p>
                </div>
              </div>
            </div>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label>QR Code</label>
              <div className={estilo.fotoLinha}>
                {editando && qrAtual ? (
                  <img className={`${estilo.preview} ${estilo.previewQr}`} src={qrAtual} alt="QR Code do produto" />
                ) : (
                  <div className={estilo.previewVazio}>QR</div>
                )}
                <p className={estilo.dica}>
                  O QR Code é gerado automaticamente ao guardar. Quando for lido na tela de vendas,
                  o produto é adicionado à venda.
                </p>
              </div>
            </div>

          </div>
        </div>

        <div className={estilo.rodape}>
          <button type="button" className={estilo.btn} onClick={aoFechar}>Cancelar</button>
          <button type="submit" className={`${estilo.btn} ${estilo.btnPrimario}`} disabled={carregando || aGuardar}>
            {aGuardar ? 'A guardar...' : editando ? 'Guardar alterações' : 'Inserir produto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
