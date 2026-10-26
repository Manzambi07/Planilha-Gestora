import { useEffect, useState } from 'react'
import estilo from './Painel.module.css'
import modal from './Modal.module.css'
import ModalGestao from './ModalGestao'
import { pedir } from './api'
import { n } from './formatar'

const camposIva = [
  { nome: 'nome', rotulo: 'Nome', obrigatorio: true, max: 60, cheio: true },
  { nome: 'percentagem', rotulo: 'Percentagem (%)', obrigatorio: true, max: 6 },
  { nome: 'motivo_isencao', rotulo: 'Motivo de isenção (se 0%)', max: 150, cheio: true },
]
const camposMetodo = [{ nome: 'nome', rotulo: 'Nome', obrigatorio: true, max: 50, cheio: true }]

export default function DefListas({ podeEditar }) {
  const [taxas, setTaxas] = useState([])
  const [metodos, setMetodos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [modalIva, setModalIva] = useState(false)
  const [modalMetodos, setModalMetodos] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    Promise.all([
      pedir('/api/definicoes/iva', { signal: controlador.signal }),
      pedir('/api/definicoes/metodos-pagamento', { signal: controlador.signal }),
    ])
      .then(([i, m]) => {
        setTaxas(i.taxas)
        setMetodos(m.metodos)
        setErro('')
        setCarregando(false)
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })
    return () => controlador.abort()
  }, [tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  if (carregando) return <p className={estilo.vazioPainel}>A carregar...</p>
  if (erro) return <div className={modal.erro} role="alert" style={{ margin: 30 }}>{erro}</div>

  return (
    <div className={estilo.listasDuas}>
      <section className={estilo.painel}>
        <div className={estilo.listaCabecalho}>
          <div>
            <h2 className={estilo.secaoTitulo}>Taxas de IVA</h2>
            <p className={estilo.secaoSub} style={{ margin: 0 }}>Usadas nos produtos e nas faturas.</p>
          </div>
          {podeEditar && (
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => setModalIva(true)}>Gerir</button>
          )}
        </div>

        {taxas.length === 0 ? (
          <p className={estilo.vazioPainel}>Ainda não há taxas de IVA.</p>
        ) : (
          <ul className={estilo.listaSimples}>
            {taxas.map((t) => (
              <li key={t.id}>
                <span>
                  {t.nome}
                  {t.motivo_isencao && <span className={estilo.listaNota} style={{ display: 'block' }}>{t.motivo_isencao}</span>}
                </span>
                <strong>{n(t.percentagem)}%</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={estilo.painel}>
        <div className={estilo.listaCabecalho}>
          <div>
            <h2 className={estilo.secaoTitulo}>Métodos de pagamento</h2>
            <p className={estilo.secaoSub} style={{ margin: 0 }}>Aceites ao receber pagamentos.</p>
          </div>
          {podeEditar && (
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => setModalMetodos(true)}>Gerir</button>
          )}
        </div>

        {metodos.length === 0 ? (
          <p className={estilo.vazioPainel}>Ainda não há métodos de pagamento.</p>
        ) : (
          <ul className={estilo.listaSimples}>
            {metodos.map((m) => <li key={m.id}><span>{m.nome}</span></li>)}
          </ul>
        )}
      </section>

      {podeEditar && (
        <>
          <ModalGestao
            aberto={modalIva}
            aoFechar={() => setModalIva(false)}
            aoAlterar={recarregar}
            titulo="Taxas de IVA"
            endpoint="definicoes/iva"
            chave="taxas"
            campos={camposIva}
            descreverItem={(t) => `${n(t.percentagem)}%${t.motivo_isencao ? `, ${t.motivo_isencao}` : ''}`}
            rotuloNovo="Nova taxa"
            rotuloEditar="Editar taxa"
            textoVazio="Ainda não há taxas de IVA."
          />
          <ModalGestao
            aberto={modalMetodos}
            aoFechar={() => setModalMetodos(false)}
            aoAlterar={recarregar}
            titulo="Métodos de pagamento"
            endpoint="definicoes/metodos-pagamento"
            chave="metodos"
            campos={camposMetodo}
            descreverItem={() => ''}
            rotuloNovo="Novo método"
            rotuloEditar="Editar método"
            textoVazio="Ainda não há métodos de pagamento."
          />
        </>
      )}
    </div>
  )
}
