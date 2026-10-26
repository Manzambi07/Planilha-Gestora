import { useEffect, useState } from 'react'
import { Printer, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import style from './Login.module.css'
import barra from './Planilha.module.css'
import estilo from './Painel.module.css'
import { BarrasPorDia, BarrasHorizontais } from './Graficos'
import { pedir } from './api'
import { kz, kzCurto, n, diaCurto } from './formatar'

const PERIODOS = [7, 30, 90]

export default function Analise() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()
    setCarregando(true)
    setErro('')

    pedir(`/api/analise?dias=${dias}`, { signal: controlador.signal })
      .then((d) => {
        setDados(d)
        setCarregando(false)
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })

    return () => controlador.abort()
  }, [dias, tentativa])

  const k = dados && dados.kpis
  const semVendas = dados && k.documentos === 0
  const semMovimentos = dados && dados.movimentosPorDia.every((d) => d.entradas === 0 && d.saidas === 0)

  return (
    <div className={estilo.tela}>
      <main className={style.pagina}>
        <div className={barra.barra}>
          <div className={barra.grupo} role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${barra.botao} ${dias === p ? estilo.periodoAtivo : ''}`}
                aria-pressed={dias === p}
                onClick={() => setDias(p)}
              >
                {p} dias
              </button>
            ))}
          </div>

          <span className={barra.divisor} />

          <div className={barra.grupo}>
            <button type="button" className={barra.botao} onClick={() => window.print()}>
              <Printer color="black" size={18} /> Imprimir
            </button>
            <button type="button" className={barra.botao} onClick={() => setTentativa((t) => t + 1)} disabled={carregando}>
              <RefreshCw color="black" size={18} /> Atualizar
            </button>
          </div>
        </div>

        {dados && (
          <span className={barra.resultado}>
            {diaCurto(dados.periodo.desde)} a {diaCurto(dados.periodo.ate)}
          </span>
        )}
      </main>

      <div className={estilo.secao}>
        {carregando && !dados && <p className={estilo.vazioPainel}>A carregar análise...</p>}

        {erro && (
          <p className={estilo.vazioPainel}>
            {erro}{' '}
            <button type="button" className={style.linkBtn} onClick={() => setTentativa((t) => t + 1)}>
              Tentar novamente
            </button>
          </p>
        )}

        {dados && (
          <>
            {/* ---- números principais ---- */}
            <section className={estilo.kpis} aria-label="Números principais">
              <div className={estilo.kpi}>
                <p className={estilo.kpiRotulo}>Vendas nos últimos {dados.periodo.dias} dias</p>
                <p className={estilo.kpiValor}>{kz(k.vendasPeriodo)}</p>
                <p className={estilo.kpiNota}>
                  {k.variacaoVendas === null ? (
                    'Sem vendas antes deste período para comparar.'
                  ) : (
                    <>
                      {k.variacaoVendas >= 0 ? <TrendingUp size={16} color="#0a8f0e" /> : <TrendingDown size={16} color="#d93025" />}
                      <span className={k.variacaoVendas >= 0 ? estilo.sobe : estilo.desce}>
                        {k.variacaoVendas >= 0 ? '+' : ''}{n(k.variacaoVendas)}%
                      </span>
                      face aos {dados.periodo.dias} dias anteriores
                    </>
                  )}
                </p>
              </div>

              <div className={estilo.kpi}>
                <p className={estilo.kpiRotulo}>Documentos emitidos</p>
                <p className={estilo.kpiValor}>{n(k.documentos)}</p>
                <p className={estilo.kpiNota}>Ticket médio: {kz(k.ticketMedio)}</p>
              </div>

              <div className={estilo.kpi}>
                <p className={estilo.kpiRotulo}>Valor do stock (preço de venda)</p>
                <p className={estilo.kpiValor}>{kzCurto(k.valorStockVenda)}</p>
                <p className={estilo.kpiNota}>
                  Custo {kzCurto(k.valorStockCusto)}, margem {kzCurto(k.margemPotencial)}
                </p>
              </div>

              <div className={estilo.kpi}>
                <p className={estilo.kpiRotulo}>Produtos com stock baixo</p>
                <p className={`${estilo.kpiValor} ${k.stockBaixo > 0 ? estilo.alerta : ''}`}>{n(k.stockBaixo)}</p>
                <p className={estilo.kpiNota}>
                  {n(k.semStock)} sem stock, {n(k.produtosAtivos)} produtos ativos
                </p>
              </div>
            </section>

            {/* ---- vendas ---- */}
            <div className={estilo.grelha}>
              <section className={estilo.painel}>
                <h2 className={estilo.secaoTitulo}>Vendas por dia</h2>
                <p className={estilo.secaoSub}>Faturas, faturas-recibo e notas de débito, menos notas de crédito.</p>
                {semVendas ? (
                  <p className={estilo.vazioPainel}>Ainda não há documentos emitidos neste período.</p>
                ) : (
                  <BarrasPorDia
                    dados={dados.vendasPorDia}
                    series={[{ chave: 'total', nome: 'Vendas', cor: '#2acd2d' }]}
                    formatar={kz}
                    descricao={`Vendas por dia nos últimos ${dados.periodo.dias} dias`}
                  />
                )}
              </section>

              <section className={estilo.painel}>
                <h2 className={estilo.secaoTitulo}>Mais vendidos</h2>
                <p className={estilo.secaoSub}>Por valor, no período.</p>
                {dados.topProdutos.length === 0 ? (
                  <p className={estilo.vazioPainel}>Sem vendas de produtos neste período.</p>
                ) : (
                  <BarrasHorizontais
                    itens={dados.topProdutos.map((p) => ({
                      nome: p.nome,
                      valor: p.valor,
                      sub: `${n(p.quantidade)} vendidos`,
                    }))}
                    formatar={kz}
                  />
                )}
              </section>
            </div>

            {/* ---- stock ---- */}
            <div className={estilo.grelha}>
              <section className={estilo.painel}>
                <h2 className={estilo.secaoTitulo}>Entradas e saídas de stock</h2>
                <div className={estilo.legenda}>
                  <span className={estilo.legendaItem}><span className={estilo.quadrado} style={{ background: '#2acd2d' }} />Entradas</span>
                  <span className={estilo.legendaItem}><span className={estilo.quadrado} style={{ background: '#0d0d0e' }} />Saídas</span>
                </div>
                {semMovimentos ? (
                  <p className={estilo.vazioPainel}>Sem movimentos de stock neste período.</p>
                ) : (
                  <BarrasPorDia
                    dados={dados.movimentosPorDia}
                    series={[
                      { chave: 'entradas', nome: 'Entradas', cor: '#2acd2d' },
                      { chave: 'saidas', nome: 'Saídas', cor: '#0d0d0e' },
                    ]}
                    formatar={(v) => `${n(v)} un.`}
                    descricao={`Entradas e saídas de stock por dia nos últimos ${dados.periodo.dias} dias`}
                  />
                )}
              </section>

              <section className={estilo.painel}>
                <h2 className={estilo.secaoTitulo}>Stock por categoria</h2>
                <p className={estilo.secaoSub}>Valor ao preço de venda.</p>
                {dados.stockPorCategoria.length === 0 ? (
                  <p className={estilo.vazioPainel}>Ainda não há produtos.</p>
                ) : (
                  <BarrasHorizontais
                    itens={dados.stockPorCategoria.map((c) => ({
                      nome: c.nome,
                      valor: c.valor,
                      sub: `${n(c.produtos)} ${c.produtos === 1 ? 'produto' : 'produtos'}, ${n(c.unidades)} unidades`,
                    }))}
                    formatar={kz}
                  />
                )}
              </section>
            </div>

            {/* ---- reposição ---- */}
            <section className={estilo.painel} style={{ marginTop: 24 }}>
              <h2 className={estilo.secaoTitulo}>Precisam de reposição</h2>
              <p className={estilo.secaoSub}>Produtos com quantidade igual ou abaixo do stock mínimo, os mais críticos primeiro.</p>
              {dados.alertasStock.length === 0 ? (
                <p className={estilo.vazioPainel}>Nenhum produto abaixo do stock mínimo.</p>
              ) : (
                <ul className={estilo.reposicao}>
                  {dados.alertasStock.map((a) => (
                    <li key={a.id} className={estilo.reposicaoLinha}>
                      <span>{a.nome}</span>
                      <span className={`${estilo.reposicaoQtd} ${a.quantidade === 0 ? estilo.alerta : ''}`}>
                        {a.quantidade === 0 ? 'Sem stock' : n(a.quantidade)}
                      </span>
                      <span className={estilo.reposicaoSub}>{a.categoria}</span>
                      <span className={estilo.reposicaoSub} style={{ textAlign: 'right' }}>mínimo {n(a.minimo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
