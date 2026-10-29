import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import Modal from './Modal'
import modal from './Modal.module.css'
import css from './Etiquetas.module.css'
import './impressao.css'
import { kz } from './formatar'

const TAMANHOS = [
  { valor: 30, rotulo: 'Pequena (30 mm)', letra: 7 },
  { valor: 40, rotulo: 'Média (40 mm)', letra: 8 },
  { valor: 60, rotulo: 'Grande (60 mm)', letra: 10 },
]

function Etiqueta({ produto, tamanho, nome, preco }) {
  const t = TAMANHOS.find((x) => x.valor === tamanho)
  const lado = tamanho - 4 // 2 mm de margem de cada lado
  return (
    <div className={css.etiqueta} style={{ width: `${tamanho}mm`, fontSize: `${t.letra}pt` }}>
      <img className={css.qr} src={produto.qrImagem} alt={`QR Code de ${produto.nome}`} style={{ width: `${lado}mm`, height: `${lado}mm` }} />
      {nome && <div className={css.nome}>{produto.nome}</div>}
      {preco && <div className={css.preco}>{kz(produto.preco)}</div>}
    </div>
  )
}

/**
 * Imprime etiquetas com o QR Code dos produtos, para colar nos produtos ou nas prateleiras.
 * produtos: [{ id, nome, preco, qrImagem }]
 */
export default function EtiquetasQR({ produtos, aoFechar }) {
  const comQr = useMemo(() => produtos.filter((p) => p.qrImagem), [produtos])
  const semQr = produtos.length - comQr.length

  const [tamanho, setTamanho] = useState(40)
  const [nome, setNome] = useState(true)
  const [preco, setPreco] = useState(false)
  const [copias, setCopias] = useState(() => Object.fromEntries(comQr.map((p) => [p.id, 1])))

  const mudarCopias = (id, valor) => {
    const n = Math.min(Math.max(parseInt(valor, 10) || 0, 0), 200)
    setCopias((c) => ({ ...c, [id]: n }))
  }

  const etiquetas = useMemo(
    () => comQr.flatMap((p) => Array.from({ length: copias[p.id] || 0 }, (_, i) => ({ chave: `${p.id}-${i}`, produto: p }))),
    [comQr, copias],
  )

  return (
    <Modal aberto titulo="Imprimir etiquetas com QR Code" aoFechar={aoFechar}>
      <div className={modal.corpo}>
        {semQr > 0 && (
          <p className={css.aviso} role="status">
            {semQr === 1 ? '1 produto ainda não tem QR Code gerado e ficou de fora.' : `${semQr} produtos ainda não têm QR Code gerado e ficaram de fora.`}
          </p>
        )}

        <div className={css.opcoes}>
          <div className={modal.campo}>
            <label htmlFor="etq-tamanho">Tamanho da etiqueta</label>
            <select id="etq-tamanho" value={tamanho} onChange={(e) => setTamanho(Number(e.target.value))}>
              {TAMANHOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <label className={css.verificacao}>
            <input type="checkbox" checked={nome} onChange={(e) => setNome(e.target.checked)} /> Mostrar o nome
          </label>
          <label className={css.verificacao}>
            <input type="checkbox" checked={preco} onChange={(e) => setPreco(e.target.checked)} /> Mostrar o preço
          </label>
        </div>

        <ul className={css.lista} aria-label="Produtos e número de etiquetas">
          {comQr.map((p) => (
            <li key={p.id} className={css.linha}>
              <span className={css.linhaNome} title={p.nome}>{p.nome}</span>
              <label>
                <span style={{ fontSize: 12, color: '#6b7280', marginRight: 6 }}>Etiquetas</span>
                <input
                  className={css.copias} type="number" min="0" max="200" aria-label={`Número de etiquetas de ${p.nome}`}
                  value={copias[p.id] ?? 0} onChange={(e) => mudarCopias(p.id, e.target.value)}
                />
              </label>
            </li>
          ))}
          {comQr.length === 0 && <li className={css.linha}>Nenhum produto com QR Code.</li>}
        </ul>

        <div className={css.previa} aria-label="Pré-visualização">
          <div className={css.grelha}>
            {etiquetas.slice(0, 12).map((e) => <Etiqueta key={e.chave} produto={e.produto} tamanho={tamanho} nome={nome} preco={preco} />)}
          </div>
          {etiquetas.length > 12 && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#4b5563' }}>... e mais {etiquetas.length - 12} etiquetas.</p>}
          {etiquetas.length === 0 && <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>Indique quantas etiquetas quer de cada produto.</p>}
        </div>
      </div>

      <div className={modal.rodape}>
        <button type="button" className={modal.btn} onClick={aoFechar}>Fechar</button>
        <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} disabled={etiquetas.length === 0} onClick={() => window.print()}>
          <Printer size={16} />&nbsp;Imprimir {etiquetas.length > 0 ? `${etiquetas.length} etiqueta${etiquetas.length === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      {createPortal(
        <div className="portal-impressao">
          <div className={css.folhaImpressao}>
            {etiquetas.map((e) => <Etiqueta key={e.chave} produto={e.produto} tamanho={tamanho} nome={nome} preco={preco} />)}
          </div>
        </div>,
        document.body,
      )}
    </Modal>
  )
}
