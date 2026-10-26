import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import estilo from './Painel.module.css'
import modal from './Modal.module.css'
import { pedir } from './api'
import { utilizadorAtual } from './sessao'
import { PERFIS } from './formatar'

const VAZIO = { atual: '', nova: '', confirmar: '' }

export default function DefConta() {
  const eu = utilizadorAtual()
  const [valores, setValores] = useState(VAZIO)
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  const mudar = (campo) => (e) => {
    setOk(false)
    setValores((v) => ({ ...v, [campo]: e.target.value }))
  }

  const diferentes = valores.confirmar !== '' && valores.nova !== valores.confirmar

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setOk(false)
    if (valores.nova !== valores.confirmar) {
      setErro('As senhas novas não coincidem.')
      return
    }
    setAGuardar(true)
    try {
      await pedir('/api/auth/alterar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual: valores.atual, novaSenha: valores.nova }),
      })
      setValores(VAZIO)
      setOk(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <div className={estilo.formulario}>
      <h2 className={estilo.secaoTitulo}>A minha conta</h2>
      <p className={estilo.secaoSub}>Estes dados só podem ser alterados por um administrador.</p>

      <dl className={estilo.contaLinha}>
        <dt>Nome</dt><dd>{eu.nome}</dd>
        <dt>Email</dt><dd>{eu.email}</dd>
        <dt>Perfil</dt><dd>{PERFIS[eu.perfil]}</dd>
      </dl>

      <h2 className={estilo.secaoTitulo}>Alterar senha</h2>
      <p className={estilo.secaoSub}>Mínimo 8 caracteres, com letras e números.</p>

      {erro && <div className={modal.erro} role="alert">{erro}</div>}
      {ok && <div className={estilo.ok} role="status">Senha alterada.</div>}

      <form onSubmit={enviar}>
        <div className={modal.grade}>
          <div className={`${modal.campo} ${modal.cheio}`}>
            <label htmlFor="c-atual">Senha atual</label>
            <input id="c-atual" type={ver ? 'text' : 'password'} value={valores.atual} onChange={mudar('atual')}
              required autoComplete="current-password" />
          </div>
          <div className={modal.campo}>
            <label htmlFor="c-nova">Nova senha</label>
            <input id="c-nova" type={ver ? 'text' : 'password'} value={valores.nova} onChange={mudar('nova')}
              required minLength={8} maxLength={72} autoComplete="new-password" />
          </div>
          <div className={modal.campo}>
            <label htmlFor="c-confirmar">Confirmar nova senha</label>
            <input id="c-confirmar" type={ver ? 'text' : 'password'} value={valores.confirmar} onChange={mudar('confirmar')}
              required autoComplete="new-password" />
            {diferentes && <p className={modal.dica} style={{ color: '#b3261e' }}>As senhas não coincidem.</p>}
          </div>
        </div>

        <div className={modal.acoesForm}>
          <button type="submit" className={`${modal.btn} ${modal.btnPrimario}`} disabled={aGuardar}>
            {aGuardar ? 'A guardar...' : 'Alterar senha'}
          </button>
          <button type="button" className={modal.btn} onClick={() => setVer((v) => !v)}>
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}&nbsp;{ver ? 'Esconder' : 'Mostrar'} senhas
          </button>
        </div>
      </form>
    </div>
  )
}
