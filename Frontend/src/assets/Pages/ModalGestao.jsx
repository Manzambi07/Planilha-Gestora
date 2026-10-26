import { useEffect, useState } from 'react'
import { Edit, Trash } from 'lucide-react'
import Modal from './Modal'
import estilo from './Modal.module.css'
import { pedir } from './api'

// Modal genérico para gerir uma lista simples (categorias, fornecedores):
// formulário em cima (inserir / editar) e a lista com editar e eliminar por baixo.
export default function ModalGestao({
  aberto,
  aoFechar,
  aoAlterar, // chamado depois de inserir / editar / eliminar (a página recarrega os produtos)
  titulo,
  endpoint, // 'categorias' | 'fornecedores'
  chave, // nome da lista na resposta da API
  campos, // [{ nome, rotulo, tipo, obrigatorio, max, cheio }]
  descreverItem, // (item) => texto pequeno por baixo do nome
  rotuloNovo,
  rotuloEditar,
  textoVazio,
}) {
  const valoresVazios = () => Object.fromEntries(campos.map((c) => [c.nome, '']))

  const [itens, setItens] = useState([])
  const [valores, setValores] = useState(valoresVazios)
  const [editandoId, setEditandoId] = useState(null)
  const [confirmarId, setConfirmarId] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  const carregar = async (sinal) => {
    setCarregando(true)
    try {
      const dados = await pedir(`/api/${endpoint}`, { signal: sinal })
      setItens(dados[chave])
    } catch (e) {
      if (e.name !== 'AbortError') setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  // ao abrir: limpa tudo e carrega a lista
  useEffect(() => {
    if (!aberto) return
    const controlador = new AbortController()
    setValores(valoresVazios())
    setEditandoId(null)
    setConfirmarId(null)
    setErro('')
    carregar(controlador.signal)
    return () => controlador.abort()
  }, [aberto])

  const limparFormulario = () => {
    setValores(valoresVazios())
    setEditandoId(null)
  }

  const iniciarEdicao = (item) => {
    setEditandoId(item.id)
    setValores(Object.fromEntries(campos.map((c) => [c.nome, item[c.nome] ?? ''])))
    setConfirmarId(null)
    setErro('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setAGuardar(true)
    try {
      await pedir(editandoId ? `/api/${endpoint}/${editandoId}` : `/api/${endpoint}`, {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      limparFormulario()
      await carregar()
      aoAlterar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  const eliminar = async (id) => {
    setErro('')
    try {
      await pedir(`/api/${endpoint}/${id}`, { method: 'DELETE' })
      setConfirmarId(null)
      if (editandoId === id) limparFormulario()
      await carregar()
      aoAlterar()
    } catch (err) {
      setConfirmarId(null)
      setErro(err.message)
    }
  }

  return (
    <Modal aberto={aberto} titulo={titulo} aoFechar={aoFechar} estreita>
      <div className={estilo.corpo}>
        {erro && <div className={estilo.erro} role="alert">{erro}</div>}

        <form onSubmit={enviar}>
          <p className={estilo.subtitulo} style={{ marginTop: 0, marginBottom: 12 }}>
            {editandoId ? rotuloEditar : rotuloNovo}
          </p>

          <div className={estilo.grade}>
            {campos.map((c) => (
              <div key={c.nome} className={`${estilo.campo} ${c.cheio ? estilo.cheio : ''}`}>
                <label htmlFor={`${endpoint}-${c.nome}`}>
                  {c.rotulo} {c.obrigatorio && <span className={estilo.obrigatorio}>*</span>}
                </label>
                <input
                  id={`${endpoint}-${c.nome}`}
                  type={c.tipo || 'text'}
                  required={c.obrigatorio}
                  maxLength={c.max}
                  value={valores[c.nome]}
                  onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className={estilo.acoesForm}>
            <button type="submit" className={`${estilo.btn} ${estilo.btnPrimario}`} disabled={aGuardar}>
              {aGuardar ? 'A guardar...' : editandoId ? 'Guardar alterações' : 'Inserir'}
            </button>
            {editandoId && (
              <button type="button" className={estilo.btn} onClick={limparFormulario}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>

        <p className={estilo.subtitulo}>Registados ({itens.length})</p>

        {carregando && itens.length === 0 ? (
          <p className={estilo.vazio}>A carregar...</p>
        ) : itens.length === 0 ? (
          <p className={estilo.vazio}>{textoVazio}</p>
        ) : (
          <ul className={estilo.lista}>
            {itens.map((item) => (
              <li key={item.id} className={estilo.item}>
                <div className={estilo.itemTexto}>
                  <div className={estilo.itemNome}><span style={{color:'black'}}>{item.nome}</span></div>
                  {descreverItem(item) && <div className={estilo.itemSub}>{descreverItem(item)}</div>}
                </div>

                <div className={estilo.itemAcoes}>
                  {confirmarId === item.id ? (
                    <div className={estilo.confirmar}>
                      <span>Eliminar?</span>
                      <button
                        type="button"
                        className={`${estilo.btn} ${estilo.btnPequeno} ${estilo.btnPerigo}`}
                        onClick={() => eliminar(item.id)}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        className={`${estilo.btn} ${estilo.btnPequeno}`}
                        onClick={() => setConfirmarId(null)}
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={estilo.iconeBtn}
                        title="Editar"
                        aria-label={`Editar ${item.nome}`}
                        onClick={() => iniciarEdicao(item)}
                      >
                        <Edit size={18} color="#2acd2d" />
                      </button>
                      <button
                        type="button"
                        className={estilo.iconeBtn}
                        title="Eliminar"
                        aria-label={`Eliminar ${item.nome}`}
                        onClick={() => setConfirmarId(item.id)}
                      >
                        <Trash size={18} color="#2acd2d" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={estilo.rodape}>
        <button type="button" className={estilo.btn} onClick={aoFechar}>Fechar</button>
      </div>
    </Modal>
  )
}
