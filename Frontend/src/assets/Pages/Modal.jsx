import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import estilo from './Modal.module.css'

// Caixa de diálogo base: fecha com Esc, com o X ou ao clicar fora
export default function Modal({ aberto, titulo, aoFechar, estreita = false, children }) {
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e) => {
      if (e.key === 'Escape') fechar.current()
    }
    window.addEventListener('keydown', aoTeclar)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden' // impede o scroll da página por trás
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  if (!aberto) return null

  return (
    <div
      className={estilo.fundo}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div
        className={`${estilo.caixa} ${estreita ? estilo.estreita : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className={estilo.cabecalho}>
          <h2>{titulo}</h2>
          <button type="button" className={estilo.fechar} onClick={aoFechar} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
