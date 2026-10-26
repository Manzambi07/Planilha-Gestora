import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Modal from './Modal'
import estilo from './Modal.module.css'
import { pedir } from './api'

const PERFIS = [
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Acesso total: utilizadores, definições, análise e produtos.' },
  { valor: 'gestor', rotulo: 'Gestor', descricao: 'Gere produtos, categorias e fornecedores e vê a análise.' },
  { valor: 'vendedor', rotulo: 'Vendedor', descricao: 'Consulta produtos e stock. Não altera dados.' },
]

// utilizador = null  -> criar | utilizador = {...} -> editar
// O pai deve usar key={utilizador?.id ?? 'novo'} para o formulário começar limpo.
export default function ModalUsuario({ utilizador, aoFechar, aoGuardar }) {
  const editar = Boolean(utilizador)

  const [valores, setValores] = useState({
    nome: utilizador ? utilizador.nome : '',
    email: utilizador ? utilizador.email : '',
    perfil: utilizador ? utilizador.perfil : 'vendedor',
    senha: '',
    confirmar: '',
  })
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)

  const mudar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }))
  const senhasDiferentes = valores.confirmar !== '' && valores.senha !== valores.confirmar
  const descricaoPerfil = PERFIS.find((p) => p.valor === valores.perfil).descricao

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    if (!editar && valores.senha !== valores.confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setAGuardar(true)
    try {
      const corpo = { nome: valores.nome, email: valores.email, perfil: valores.perfil }
      if (!editar) corpo.senha = valores.senha

      await pedir(editar ? `/api/utilizadores/${utilizador.id}` : '/api/utilizadores', {
        method: editar ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      aoGuardar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <Modal aberto titulo={editar ? 'Editar utilizador' : 'Inserir utilizador'} aoFechar={aoFechar} estreita>
      <form className={estilo.formulario} onSubmit={enviar}>
        <div className={estilo.corpo}>
          {erro && <div className={estilo.erro} role="alert">{erro}</div>}

          <div className={estilo.grade}>
            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label htmlFor="u-nome">Nome <span className={estilo.obrigatorio}>*</span></label>
              <input id="u-nome" value={valores.nome} onChange={mudar('nome')} maxLength={120} required autoComplete="off" />
            </div>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label htmlFor="u-email">Email <span className={estilo.obrigatorio}>*</span></label>
              <input id="u-email" type="email" value={valores.email} onChange={mudar('email')} maxLength={150} required autoComplete="off" />
            </div>

            <div className={`${estilo.campo} ${estilo.cheio}`}>
              <label htmlFor="u-perfil">Perfil <span className={estilo.obrigatorio}>*</span></label>
              <select id="u-perfil" value={valores.perfil} onChange={mudar('perfil')}>
                {PERFIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
              </select>
              <p className={estilo.dica}>{descricaoPerfil}</p>
            </div>

            {!editar && (
              <>
                <div className={estilo.campo}>
                  <label htmlFor="u-senha">Senha <span className={estilo.obrigatorio}>*</span></label>
                  <input
                    id="u-senha"
                    type={verSenha ? 'text' : 'password'}
                    value={valores.senha}
                    onChange={mudar('senha')}
                    minLength={8}
                    maxLength={72}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className={estilo.campo}>
                  <label htmlFor="u-confirmar">Confirmar senha <span className={estilo.obrigatorio}>*</span></label>
                  <input
                    id="u-confirmar"
                    type={verSenha ? 'text' : 'password'}
                    value={valores.confirmar}
                    onChange={mudar('confirmar')}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className={`${estilo.cheio}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" className={`${estilo.btn} ${estilo.btnPequeno}`} onClick={() => setVerSenha((v) => !v)}>
                    {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}&nbsp;{verSenha ? 'Esconder' : 'Mostrar'} senhas
                  </button>
                  <span className={estilo.dica}>
                    {senhasDiferentes ? 'As senhas não coincidem.' : 'Mínimo 8 caracteres, com letras e números.'}
                  </span>
                </div>
              </>
            )}
          </div>

          {editar && (
            <p className={estilo.dica} style={{ marginTop: 14 }}>
              Para mudar a senha, usa o botão de chave na lista de utilizadores.
            </p>
          )}
        </div>

        <div className={estilo.rodape}>
          <button type="button" className={estilo.btn} onClick={aoFechar}>Cancelar</button>
          <button type="submit" className={`${estilo.btn} ${estilo.btnPrimario}`} disabled={aGuardar}>
            {aGuardar ? 'A guardar...' : editar ? 'Guardar alterações' : 'Inserir utilizador'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
