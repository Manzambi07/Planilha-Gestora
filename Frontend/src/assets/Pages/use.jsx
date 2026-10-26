import { useEffect, useState } from 'react'
import {
  PlusCircle, Printer, Search, Edit, Trash, KeyRound, Unlock, RotateCcw, Copy, Check,
} from 'lucide-react'
import style from './Login.module.css'
import barra from './Planilha.module.css'
import estilo from './Painel.module.css'
import modal from './Modal.module.css'
import Modal from './Modal'
import ModalUsuario from './ModalUsuario'
import { pedir } from './api'
import { utilizadorAtual } from './sessao'
import { dataHora, PERFIS } from './formatar'

const LIMITE = 20
const classePerfil = { admin: estilo.perfilAdmin, gestor: estilo.perfilGestor, vendedor: estilo.perfilVendedor }

export default function Usuarios() {
  const eu = utilizadorAtual()

  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [perfil, setPerfil] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)

  const [lista, setLista] = useState([])
  const [total, setTotal] = useState(0)
  const [totais, setTotais] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState('')
  const [erroAcao, setErroAcao] = useState('')

  const [formulario, setFormulario] = useState(null) // { utilizador } | null
  const [desativar, setDesativar] = useState(null)
  const [senha, setSenha] = useState(null) // { utilizador, temporaria }
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const recarregar = () => setTentativa((n) => n + 1)

  // espera um momento depois de escrever antes de pesquisar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busca])

  useEffect(() => {
    const controlador = new AbortController()
    setCarregando(true)
    setErroLista('')

    const params = new URLSearchParams({ pagina, limite: LIMITE })
    if (buscaAplicada) params.set('busca', buscaAplicada)
    if (perfil) params.set('perfil', perfil)
    if (estado) params.set('estado', estado)

    pedir(`/api/utilizadores?${params}`, { signal: controlador.signal })
      .then((d) => {
        setLista(d.utilizadores)
        setTotal(d.total)
        setTotais(d.totais)
        setCarregando(false)
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErroLista(e.message)
        setCarregando(false)
      })

    return () => controlador.abort()
  }, [buscaAplicada, perfil, estado, pagina, tentativa])

  const limparFiltros = () => {
    setBusca('')
    setPerfil('')
    setEstado('')
    setPagina(1)
  }

  // ---- ações sobre uma linha
  const executar = async (acao) => {
    setErroAcao('')
    try {
      await acao()
      recarregar()
    } catch (e) {
      setErroAcao(e.message)
    }
  }

  const reativar = (u) => executar(() => pedir(`/api/utilizadores/${u.id}/reativar`, { method: 'POST' }))
  const desbloquear = (u) => executar(() => pedir(`/api/utilizadores/${u.id}/desbloquear`, { method: 'POST' }))

  const confirmarDesativar = async () => {
    setATrabalhar(true)
    setErroAcao('')
    try {
      await pedir(`/api/utilizadores/${desativar.id}`, { method: 'DELETE' })
      setDesativar(null)
      recarregar()
    } catch (e) {
      setErroAcao(e.message)
      setDesativar(null)
    } finally {
      setATrabalhar(false)
    }
  }

  const gerarSenha = async () => {
    setATrabalhar(true)
    setErroAcao('')
    try {
      const d = await pedir(`/api/utilizadores/${senha.utilizador.id}/redefinir-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setSenha((s) => ({ ...s, temporaria: d.senhaTemporaria }))
      recarregar()
    } catch (e) {
      setErroAcao(e.message)
      setSenha(null)
    } finally {
      setATrabalhar(false)
    }
  }

  const copiarSenha = async () => {
    try {
      await navigator.clipboard.writeText(senha.temporaria)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sem permissão para a área de transferência: o utilizador copia à mão */
    }
  }

  const fecharSenha = () => {
    setSenha(null)
    setCopiado(false)
  }

  const comFiltros = Boolean(buscaAplicada || perfil || estado)
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  return (
    <div className={style.conteudo}>
      <main className={style.pagina}>
        <div className={barra.barra}>
          <div className={barra.grupo}>
            <button type="button" className={barra.botao} onClick={() => setFormulario({ utilizador: null })}>
              <PlusCircle color="black" size={18} /> Inserir usuário
            </button>
          </div>

          <span className={barra.divisor} />

          <div className={barra.grupo}>
            <button type="button" className={barra.botao} title="Imprimir" onClick={() => window.print()}>
              <Printer color="black" size={18} /> Imprimir
            </button>
          </div>

          <span className={barra.divisor} />

          <div className={barra.grupo}>
            <select
              className={estilo.filtro}
              aria-label="Filtrar por perfil"
              value={perfil}
              onChange={(e) => { setPerfil(e.target.value); setPagina(1) }}
            >
              <option value="">Todos os perfis</option>
              <option value="admin">Administradores</option>
              <option value="gestor">Gestores</option>
              <option value="vendedor">Vendedores</option>
            </select>
            <select
              className={estilo.filtro}
              style={{ marginLeft: 6 }}
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPagina(1) }}
            >
              <option value="">Todos os estados</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          {totais && (
            <span className={barra.resultado}>
              {totais.ativos} {totais.ativos === 1 ? 'ativo' : 'ativos'}
              {totais.inativos > 0 && `, ${totais.inativos} ${totais.inativos === 1 ? 'inativo' : 'inativos'}`}
            </span>
          )}
        </div>

        <div className={barra.divInput} style={{ position: 'relative' }}>
          <Search
            size={18}
            color="#6b6b6b"
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="pesquisar por nome ou email"
            aria-label="Pesquisar utilizadores"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ paddingLeft: 44 }}
          />
        </div>
      </main>

      {erroAcao && (
        <div className={modal.erro} role="alert" style={{ margin: '12px 30px 0' }}>{erroAcao}</div>
      )}

      <div className={style.tabelaWrap}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Estado</th>
              <th>Último acesso</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {carregando && lista.length === 0 && (
              <tr><td colSpan={7} className={style.vazio}>A carregar utilizadores...</td></tr>
            )}

            {!carregando && erroLista && (
              <tr>
                <td colSpan={7} className={style.vazio}>
                  {erroLista}{' '}
                  <button type="button" className={style.linkBtn} onClick={recarregar}>Tentar novamente</button>
                </td>
              </tr>
            )}

            {!carregando && !erroLista && lista.length === 0 && (
              <tr>
                <td colSpan={7} className={style.vazio}>
                  {comFiltros ? (
                    <>
                      Nenhum utilizador encontrado.{' '}
                      <button type="button" className={style.linkBtn} onClick={limparFiltros}>Limpar filtros</button>
                    </>
                  ) : (
                    <>
                      Ainda não há utilizadores.{' '}
                      <button type="button" className={style.linkBtn} onClick={() => setFormulario({ utilizador: null })}>
                        Inserir o primeiro
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}

            {!erroLista && lista.map((u) => {
              const sou = eu && u.id === eu.id
              const estadoTexto = !u.ativo ? 'Inativo' : u.bloqueado ? 'Bloqueado' : 'Ativo'
              const classePonto = !u.ativo ? estilo.pontoInativo : u.bloqueado ? estilo.pontoBloqueado : ''

              return (
                <tr key={u.id} className={u.ativo ? '' : estilo.apagado}>
                  <td>{u.id}</td>
                  <td>
                    <strong>{u.nome}</strong>{sou && <span style={{ color: '#6b7280' }}> (tu)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`${estilo.etiqueta} ${classePerfil[u.perfil]}`}>{PERFIS[u.perfil]}</span>
                  </td>
                  <td>
                    <span className={estilo.estado}>
                      <span className={`${estilo.ponto} ${classePonto}`} aria-hidden="true" />
                      {estadoTexto}
                    </span>
                  </td>
                  <td>{u.ultimoLogin ? dataHora(u.ultimoLogin) : 'Nunca'}</td>
                  <td>
                    <div className={estilo.celulaIcones}>
                      <button type="button" className={style.iconBtn} title="Editar" aria-label={`Editar ${u.nome}`}
                        onClick={() => setFormulario({ utilizador: u })}>
                        <Edit size={18} color="#2acd2d" />
                      </button>

                      {u.ativo && (
                        <button type="button" className={style.iconBtn} title="Redefinir senha" aria-label={`Redefinir a senha de ${u.nome}`}
                          onClick={() => setSenha({ utilizador: u, temporaria: null })}>
                          <KeyRound size={18} color="#2acd2d" />
                        </button>
                      )}

                      {u.bloqueado && (
                        <button type="button" className={style.iconBtn} title="Desbloquear" aria-label={`Desbloquear ${u.nome}`}
                          onClick={() => desbloquear(u)}>
                          <Unlock size={18} color="#2acd2d" />
                        </button>
                      )}

                      {u.ativo && !sou && (
                        <button type="button" className={style.iconBtn} title="Desativar" aria-label={`Desativar ${u.nome}`}
                          onClick={() => { setErroAcao(''); setDesativar(u) }}>
                          <Trash size={18} color="#2acd2d" />
                        </button>
                      )}

                      {!u.ativo && (
                        <button type="button" className={style.iconBtn} title="Reativar" aria-label={`Reativar ${u.nome}`}
                          onClick={() => reativar(u)}>
                          <RotateCcw size={18} color="#2acd2d" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > LIMITE && (
        <div className={estilo.rodapeLista}>
          <span>Página {pagina} de {totalPaginas} ({total} utilizadores)</span>
          <div className={estilo.paginas}>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}>Seguinte</button>
          </div>
        </div>
      )}

      {/* inserir / editar */}
      {formulario && (
        <ModalUsuario
          key={formulario.utilizador ? formulario.utilizador.id : 'novo'}
          utilizador={formulario.utilizador}
          aoFechar={() => setFormulario(null)}
          aoGuardar={() => { setFormulario(null); recarregar() }}
        />
      )}

      {/* desativar */}
      <Modal aberto={Boolean(desativar)} titulo="Desativar utilizador" aoFechar={() => setDesativar(null)} estreita>
        <div className={modal.corpo}>
          <p className={modal.texto}>
            Desativar <strong>{desativar && desativar.nome}</strong>? Deixa de poder iniciar sessão,
            mas o histórico fica guardado. Podes reativar a conta mais tarde.
          </p>
        </div>
        <div className={modal.rodape}>
          <button type="button" className={modal.btn} onClick={() => setDesativar(null)}>Cancelar</button>
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} disabled={aTrabalhar} onClick={confirmarDesativar}>
            {aTrabalhar ? 'A desativar...' : 'Desativar'}
          </button>
        </div>
      </Modal>

      {/* redefinir senha */}
      <Modal aberto={Boolean(senha)} titulo="Redefinir senha" aoFechar={fecharSenha} estreita>
        {senha && !senha.temporaria && (
          <>
            <div className={modal.corpo}>
              <p className={modal.texto}>
                Gerar uma senha temporária para <strong>{senha.utilizador.nome}</strong>? A senha atual
                deixa de funcionar e a conta é desbloqueada.
              </p>
            </div>
            <div className={modal.rodape}>
              <button type="button" className={modal.btn} onClick={fecharSenha}>Cancelar</button>
              <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} disabled={aTrabalhar} onClick={gerarSenha}>
                {aTrabalhar ? 'A gerar...' : 'Gerar senha'}
              </button>
            </div>
          </>
        )}

        {senha && senha.temporaria && (
          <>
            <div className={modal.corpo}>
              <p className={modal.texto} style={{ marginBottom: 12 }}>
                Senha temporária de <strong>{senha.utilizador.nome}</strong>. Só aparece agora:
                entrega-a e pede para a mudar em Definições, A minha conta.
              </p>
              <div className={estilo.senhaTemp}>
                <span style={{ flex: 1, color: '#000' }}>{senha.temporaria}</span>
                <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={copiarSenha}>
                  {copiado ? <Check size={16} /> : <Copy size={16} />}&nbsp;{copiado ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            </div>
            <div className={modal.rodape}>
              <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} onClick={fecharSenha}>Concluir</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
