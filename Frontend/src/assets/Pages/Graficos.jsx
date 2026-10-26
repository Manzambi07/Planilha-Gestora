import estilo from './Painel.module.css'
import { diaCurto } from './formatar'

// Valor "redondo" para o topo do eixo (ex.: 4 370 -> 5 000)
function topoDoEixo(maximo) {
  if (maximo <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(maximo))
  const passo = [1, 2, 2.5, 5, 10].find((m) => m * potencia >= maximo)
  return passo * potencia
}

const compacto = (v) =>
  new Intl.NumberFormat('pt-AO', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

/**
 * Barras por dia (1 ou 2 séries lado a lado).
 * dados:  [{ dia: '2026-10-25', total: 1200 }, ...]
 * series: [{ chave: 'total', nome: 'Vendas', cor: '#2acd2d' }]
 * formatar: (valor) => texto para o tooltip
 */
export function BarrasPorDia({ dados, series, formatar, descricao }) {
  const L = 720
  const A = 230
  const margem = { esq: 46, dir: 8, topo: 10, base: 26 }
  const larguraUtil = L - margem.esq - margem.dir
  const alturaUtil = A - margem.topo - margem.base

  const maximo = Math.max(0, ...dados.flatMap((d) => series.map((s) => d[s.chave])))
  const topo = topoDoEixo(maximo)
  const grupo = larguraUtil / dados.length
  const folga = Math.min(6, grupo * 0.25)
  const larguraBarra = Math.max(1.5, (grupo - folga) / series.length)

  // mostra no máximo ~8 datas no eixo para não se sobreporem
  const passoEtiqueta = Math.ceil(dados.length / 8)
  const linhas = [0, 0.5, 1]

  return (
    <svg className={estilo.grafico} viewBox={`0 0 ${L} ${A}`} role="img" aria-label={descricao}>
      {linhas.map((f) => {
        const y = margem.topo + alturaUtil * (1 - f)
        return (
          <g key={f}>
            <line x1={margem.esq} x2={L - margem.dir} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text className={estilo.graficoEixo} x={margem.esq - 8} y={y + 4} textAnchor="end">
              {compacto(topo * f)}
            </text>
          </g>
        )
      })}

      {dados.map((d, i) => {
        const x0 = margem.esq + i * grupo + folga / 2
        return (
          <g key={d.dia}>
            {series.map((s, j) => {
              const h = (d[s.chave] / topo) * alturaUtil
              return (
                <rect
                  key={s.chave}
                  x={x0 + j * larguraBarra}
                  y={margem.topo + alturaUtil - h}
                  width={larguraBarra - 1}
                  height={Math.max(h, 0)}
                  fill={s.cor}
                >
                  <title>{`${diaCurto(d.dia)} · ${s.nome}: ${formatar(d[s.chave])}`}</title>
                </rect>
              )
            })}
            {i % passoEtiqueta === 0 && (
              <text
                className={estilo.graficoEixo}
                x={x0 + (larguraBarra * series.length) / 2}
                y={A - 8}
                textAnchor="middle"
              >
                {diaCurto(d.dia)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Lista com barras horizontais.
 * itens: [{ nome, valor, sub? }]   formatar: (valor) => texto
 */
export function BarrasHorizontais({ itens, formatar }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className={estilo.barras}>
      {itens.map((item) => (
        <li key={item.nome} className={estilo.barraLinha}>
          <span className={estilo.barraNome} title={item.nome}>{item.nome}</span>
          <span className={estilo.barraValor}>{formatar(item.valor)}</span>
          <div className={estilo.barraTrilho} aria-hidden="true">
            <div className={estilo.barraPreenchida} style={{ width: `${(item.valor / maximo) * 100}%` }} />
          </div>
          {item.sub && <span className={estilo.barraSub}>{item.sub}</span>}
        </li>
      ))}
    </ul>
  )
}
