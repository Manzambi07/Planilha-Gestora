import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import Modal from './Modal'
import modal from './Modal.module.css'
import { pedir } from './api'

// Escolher um cliente existente (pesquisa por nome ou NIF) ou criar um novo na hora.
export default function ModalCliente({ consumidorFinal, aoEscolher, aoFechar }) {
  const [modo, setModo] = useState('procurar') // 'procurar' | 'novo'
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [novo, setNovo] = useState({ nome: '', nif: '', telefone: '', email: '', endereco: '' })
  const [aGuardar, setAGuardar] = useState(false)

  useEffect(() => {
    if (modo !== 'procurar') return undefined
    const controlador = new AbortController()
    const espera = setTimeout(() => {
      setCarregando(true)
      pedir(`/api/faturacao/clientes?busca=${encodeURIComponent(busca.trim())}`, { signal: controlador.signal })
        .then((d) => { setClientes(d.clientes); setErro(''); setCarregando(false) })
        .catch((e) => {
          if (e.name === 'AbortError') return
          setErro(e.message)
          setCarregando(false)
        })
    }, 250)
    return () => { clearTimeout(espera); controlador.abort() }
  }, [busca, modo])

  const mudar = (campo) => (e) => setNovo((v) => ({ ...v, [campo]: e.target.value }))

  const criar = async (e) => {
    e.preventDefault()
    setErro('')
    setAGuardar(true)
    try {
      const d = await pedir('/api/faturacao/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo),
      })
      aoEscolher(d.cliente)
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <Modal aberto titulo={modo === 'procurar' ? 'Escolher cliente' : 'Novo cliente'} aoFechar={aoFechar} estreita>
      {modo === 'procurar' ? (
        <>
          <div className={modal.corpo}>
            {erro && <div className={modal.erro} role="alert">{erro}</div>}

            <div className={modal.campo}>
              <label htmlFor="cli-busca">Pesquisar por nome ou NIF</label>
              <input id="cli-busca" type="search" autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" />
            </div>

            <ul className={modal.lista} style={{ marginTop: 12 }}>
              <li className={modal.item}>
                <div className={modal.itemTexto}>
                  <span className={modal.itemNome}>{consumidorFinal.nome}</span>
                  <span className={modal.itemSub}>Venda sem identificação do cliente</span>
                </div>
                <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => aoEscolher(null)}>Usar</button>
              </li>

              {carregando && <li className={modal.vazio}>A pesquisar...</li>}

              {!carregando && clientes
                .filter((c) => c.nif !== consumidorFinal.nif)
                .map((c) => (
                  <li key={c.id} className={modal.item}>
                    <div className={modal.itemTexto}>
                      <span className={modal.itemNome}>{c.nome}</span>
                      <span className={modal.itemSub}>{c.nif ? `NIF ${c.nif}` : 'Sem NIF'}{c.telefone ? `, ${c.telefone}` : ''}</span>
                    </div>
                    <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => aoEscolher(c)}>Escolher</button>
                  </li>
                ))}

              {!carregando && !erro && clientes.filter((c) => c.nif !== consumidorFinal.nif).length === 0 && busca.trim() && (
                <li className={modal.vazio}>Nenhum cliente encontrado.</li>
              )}
            </ul>
          </div>
          <div className={modal.rodape}>
            <button type="button" className={modal.btn} onClick={aoFechar}>Cancelar</button>
            <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} onClick={() => { setErro(''); setModo('novo') }}>
              <UserPlus size={16} />&nbsp;Novo cliente
            </button>
          </div>
        </>
      ) : (
        <form className={modal.formulario} onSubmit={criar}>
          <div className={modal.corpo}>
            {erro && <div className={modal.erro} role="alert">{erro}</div>}
            <div className={modal.grade}>
              <div className={`${modal.campo} ${modal.cheio}`}>
                <label htmlFor="cli-nome">Nome <span className={modal.obrigatorio}>*</span></label>
                <input id="cli-nome" autoFocus required maxLength={150} value={novo.nome} onChange={mudar('nome')} />
              </div>
              <div className={modal.campo}>
                <label htmlFor="cli-nif">NIF</label>
                <input id="cli-nif" maxLength={20} value={novo.nif} onChange={mudar('nif')} />
              </div>
              <div className={modal.campo}>
                <label htmlFor="cli-tel">Telefone</label>
                <input id="cli-tel" type="tel" maxLength={30} value={novo.telefone} onChange={mudar('telefone')} />
              </div>
              <div className={`${modal.campo} ${modal.cheio}`}>
                <label htmlFor="cli-email">Email</label>
                <input id="cli-email" type="email" maxLength={150} value={novo.email} onChange={mudar('email')} />
              </div>
              <div className={`${modal.campo} ${modal.cheio}`}>
                <label htmlFor="cli-end">Endereço</label>
                <input id="cli-end" maxLength={255} value={novo.endereco} onChange={mudar('endereco')} />
              </div>
            </div>
          </div>
          <div className={modal.rodape}>
            <button type="button" className={modal.btn} onClick={() => { setErro(''); setModo('procurar') }}>Voltar</button>
            <button type="submit" className={`${modal.btn} ${modal.btnPrimario}`} disabled={aGuardar}>
              {aGuardar ? 'A guardar...' : 'Guardar e usar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
