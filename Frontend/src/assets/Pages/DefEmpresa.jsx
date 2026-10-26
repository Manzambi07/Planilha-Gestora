import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import estilo from './Painel.module.css'
import modal from './Modal.module.css'
import { pedir } from './api'

const VAZIO = { nome: '', nif: '', endereco: '', telefone: '', email: '', moeda: 'AOA' }

export default function DefEmpresa({ podeEditar }) {
  const [valores, setValores] = useState(VAZIO)
  const [logoAtual, setLogoAtual] = useState(null)
  const [novoLogo, setNovoLogo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [removerLogo, setRemoverLogo] = useState(false)

  const [carregando, setCarregando] = useState(true)
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState('')
  const [guardado, setGuardado] = useState(false)
  const ficheiro = useRef(null)

  const aplicar = (empresa) => {
    setValores({
      nome: empresa.nome || '',
      nif: empresa.nif || '',
      endereco: empresa.endereco || '',
      telefone: empresa.telefone || '',
      email: empresa.email || '',
      moeda: empresa.moeda || 'AOA',
    })
    setLogoAtual(empresa.logotipo)
  }

  useEffect(() => {
    const controlador = new AbortController()
    pedir('/api/definicoes/empresa', { signal: controlador.signal })
      .then((d) => { aplicar(d.empresa); setCarregando(false) })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })
    return () => controlador.abort()
  }, [])

  // liberta o URL temporário da pré-visualização
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  const mudar = (campo) => (e) => {
    setGuardado(false)
    setValores((v) => ({ ...v, [campo]: e.target.value }))
  }

  const escolherLogo = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) {
      setErro('O logotipo não pode ter mais de 2 MB.')
      e.target.value = ''
      return
    }
    setErro('')
    setGuardado(false)
    setNovoLogo(f)
    setRemoverLogo(false)
    setPrevia(URL.createObjectURL(f))
  }

  const tirarLogo = () => {
    setNovoLogo(null)
    setPrevia(null)
    setRemoverLogo(true)
    setGuardado(false)
    if (ficheiro.current) ficheiro.current.value = ''
  }

  const guardar = async (e) => {
    e.preventDefault()
    setErro('')
    setGuardado(false)
    setAGuardar(true)
    try {
      const corpo = new FormData()
      Object.entries(valores).forEach(([k, v]) => corpo.append(k, v))
      if (novoLogo) corpo.append('logotipo', novoLogo)
      if (removerLogo) corpo.append('removerLogotipo', '1')

      const d = await pedir('/api/definicoes/empresa', { method: 'PUT', body: corpo })
      aplicar(d.empresa)
      setNovoLogo(null)
      setPrevia(null)
      setRemoverLogo(false)
      if (ficheiro.current) ficheiro.current.value = ''
      setGuardado(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  if (carregando) return <p className={estilo.vazioPainel}>A carregar...</p>

  const logoVisivel = previa || (removerLogo ? null : logoAtual)

  return (
    <form className={estilo.formulario} onSubmit={guardar}>
      <h2 className={estilo.secaoTitulo}>Dados da empresa</h2>
      <p className={estilo.secaoSub}>
        {podeEditar
          ? 'Aparecem nas faturas e nos documentos que emitires.'
          : 'Só os administradores podem alterar estes dados.'}
      </p>

      {erro && <div className={modal.erro} role="alert">{erro}</div>}
      {guardado && <div className={estilo.ok} role="status">Dados guardados.</div>}

      <div className={modal.campo} style={{ marginBottom: 18 }}>
        <label htmlFor="emp-logo">Logotipo</label>
        <div className={estilo.logoLinha}>
          {logoVisivel
            ? <img className={estilo.logo} src={logoVisivel} alt="Logotipo da empresa" />
            : <div className={estilo.logoVazio}>Sem logotipo</div>}

          {podeEditar && (
            <div className={modal.fotoAcoes}>
              <label className={`${modal.btn} ${modal.btnPequeno}`} htmlFor="emp-logo" style={{ cursor: 'pointer', fontWeight: 400 }}>
                <Upload size={16} />&nbsp;{logoVisivel ? 'Trocar' : 'Escolher imagem'}
              </label>
              <input
                id="emp-logo"
                ref={ficheiro}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={escolherLogo}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
              />
              {logoVisivel && (
                <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={tirarLogo}>Remover</button>
              )}
            </div>
          )}
        </div>
        {podeEditar && <p className={modal.dica}>JPG, PNG ou WEBP, até 2 MB.</p>}
      </div>

      <div className={modal.grade}>
        <div className={`${modal.campo} ${modal.cheio}`}>
          <label htmlFor="emp-nome">Nome da empresa <span className={modal.obrigatorio}>*</span></label>
          <input id="emp-nome" value={valores.nome} onChange={mudar('nome')} maxLength={150} required disabled={!podeEditar} />
        </div>

        <div className={modal.campo}>
          <label htmlFor="emp-nif">NIF <span className={modal.obrigatorio}>*</span></label>
          <input id="emp-nif" value={valores.nif} onChange={mudar('nif')} maxLength={20} required disabled={!podeEditar} />
        </div>

        <div className={modal.campo}>
          <label htmlFor="emp-moeda">Moeda</label>
          <input
            id="emp-moeda"
            value={valores.moeda}
            onChange={(e) => mudar('moeda')({ target: { value: e.target.value.toUpperCase() } })}
            maxLength={3}
            pattern="[A-Za-z]{3}"
            title="3 letras, por exemplo AOA"
            disabled={!podeEditar}
          />
        </div>

        <div className={modal.campo}>
          <label htmlFor="emp-tel">Telefone</label>
          <input id="emp-tel" type="tel" value={valores.telefone} onChange={mudar('telefone')} maxLength={30} disabled={!podeEditar} />
        </div>

        <div className={modal.campo}>
          <label htmlFor="emp-email">Email</label>
          <input id="emp-email" type="email" value={valores.email} onChange={mudar('email')} maxLength={150} disabled={!podeEditar} />
        </div>

        <div className={`${modal.campo} ${modal.cheio}`}>
          <label htmlFor="emp-end">Endereço</label>
          <input id="emp-end" value={valores.endereco} onChange={mudar('endereco')} maxLength={255} disabled={!podeEditar} />
        </div>
      </div>

      {podeEditar && (
        <div className={modal.acoesForm}>
          <button type="submit" className={`${modal.btn} ${modal.btnPrimario}`} disabled={aGuardar}>
            {aGuardar ? 'A guardar...' : 'Guardar alterações'}
          </button>
        </div>
      )}
    </form>
  )
}
