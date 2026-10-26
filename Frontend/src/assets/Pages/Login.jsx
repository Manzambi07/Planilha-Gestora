import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { entrar } from './auth'
import style from './Login.module.css'
import { Mail, Lock, LogIn } from 'lucide-react'

export default function Login() {
  const [carregar, setCarregar] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const navegar = useNavigate()

  const aoEnviar = async (e) => {
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    setErroLogin('')
    setCarregar(true)
    
    try {
      const utilizador = await entrar(dados.get('email'), dados.get('senha'))
      navegar(utilizador.perfil === 'vendedor' ? '/Faturacao' : '/Geral')
    } catch (erro) {
      setErroLogin(erro.message)
    } finally {
      setCarregar(false)
    }
  }

  return (
    <div className={style.pageWrapper}>
      <div className={style.loginWrapper}>
        <form className={style.form} onSubmit={aoEnviar}>
          <div className={style.container}>
            
            {/* Cabeçalho */}
            <div className={style.headerLogin}>
              <div className={style.badgeIcon}>
                <LogIn size={24} color="#05cf16" />
              </div>
              <h2>Aceder à Conta</h2>
              <p>Introduza as suas credenciais para entrar</p>
            </div>

            {/* Inputs */}
            <div className={style.inputes}>
              <div className={style.inputGroup}>
                <label htmlFor="email">Email</label>
                <div className={style.inputWrapper}>
                  <Mail className={style.iconField} size={18} />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="Digite o seu email"
                    required
                  />
                </div>
              </div>

              <div className={style.inputGroup}>
                <label htmlFor="senha">Senha</label>
                <div className={style.inputWrapper}>
                  <Lock className={style.iconField} size={18} />
                  <input
                    id="senha"
                    type="password"
                    name="senha"
                    placeholder="Digite a sua senha"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Mensagem de Erro */}
            {erroLogin && (
              <div className={style.erroContainer}>
                <span role="alert">{erroLogin}</span>
              </div>
            )}

            {/* Botão Entrar */}
            <div className={style.btn}>
              <button type="submit" disabled={carregar}>
                {carregar ? 'A entrar...' : 'Entrar'}
              </button>
            </div>

          </div>
        </form>

        {/* Rodapé opcional */}
        <footer className={style.footer}>
          <p>© Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  )
}