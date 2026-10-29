// PostgreSQL. Só admin e gestor chegam aqui (a proteção está no server.js)
const express = require('express')
const { QueryTypes } = require('sequelize')
const { sequelize, Utilizador } = require('../models')
const { tratarErro } = require('../utils/validacao')

const router = express.Router()

// Tem de coincidir com o "timezone" do database.js (+01:00 = Angola)
const OFFSET_MS = 1 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000
const PERIODOS = [7, 30, 90]

// "2026-10-25" para o dia de hoje (no fuso da BD) menos N dias
const chaveDia = (diasAtras) =>
  new Date(Date.now() + OFFSET_MS - diasAtras * DIA_MS).toISOString().slice(0, 10)

const dinheiro = (v) => Math.round((Number(v) || 0) * 100) / 100
const consultar = (sql, replacements = {}) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT })

// Preenche os dias sem movimento com zeros para o gráfico ficar contínuo
const preencherDias = (dias, linhas, campos) => {
  const porDia = new Map(linhas.map((l) => [l.dia, l]))
  return dias.map((dia) => {
    const l = porDia.get(dia)
    const item = { dia }
    campos.forEach((c) => { item[c] = l ? Number(l[c]) || 0 : 0 })
    return item
  })
}

const ESTADOS_VALIDOS = "('emitida','paga','parcial')"

// GET /api/analise?dias=7|30|90
router.get('/', async (req, res) => {
  try {
    const pedido = parseInt(req.query.dias, 10)
    const dias = PERIODOS.includes(pedido) ? pedido : 30

    const listaDias = Array.from({ length: dias }, (_, i) => chaveDia(dias - 1 - i))
    const desde = `${listaDias[0]} 00:00:00`
    const desdeAnterior = `${chaveDia(dias * 2 - 1)} 00:00:00`

    const [
      [stock], porCategoria, alertas, movimentos,
      vendas, [anterior], topProdutos, utilizadoresAtivos,
    ] = await Promise.all([
      consultar(`
        SELECT COUNT(*) AS produtos,
               COALESCE(SUM(stock_atual), 0) AS unidades,
               COALESCE(SUM(stock_atual * preco_custo), 0) AS custo,
               COALESCE(SUM(stock_atual * preco_venda), 0) AS venda,
               COALESCE(SUM(CASE WHEN stock_atual <= stock_minimo THEN 1 ELSE 0 END), 0) AS baixo,
               COALESCE(SUM(CASE WHEN stock_atual = 0 THEN 1 ELSE 0 END), 0) AS sem_stock
        FROM produtos WHERE ativo = true`),

      consultar(`
        SELECT c.nome, COUNT(p.id) AS produtos,
               COALESCE(SUM(p.stock_atual), 0) AS unidades,
               COALESCE(SUM(p.stock_atual * p.preco_venda), 0) AS valor
        FROM categorias c
        JOIN produtos p ON p.categoria_id = c.id AND p.ativo = true
        GROUP BY c.id, c.nome
        ORDER BY valor DESC`),

      consultar(`
        SELECT p.id, p.nome, p.stock_atual AS quantidade, p.stock_minimo AS minimo, c.nome AS categoria
        FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = true AND p.stock_atual <= p.stock_minimo
        ORDER BY p.stock_atual ASC, p.nome ASC
        LIMIT 8`),

      consultar(`
        SELECT to_char(criado_em, 'YYYY-MM-DD') AS dia,
               COALESCE(SUM(CASE WHEN quantidade > 0 THEN quantidade ELSE 0 END), 0) AS entradas,
               COALESCE(SUM(CASE WHEN quantidade < 0 THEN -quantidade ELSE 0 END), 0) AS saidas
        FROM movimentos_stock
        WHERE criado_em >= :desde
        GROUP BY dia ORDER BY dia`, { desde }),

      consultar(`
        SELECT to_char(data_emissao, 'YYYY-MM-DD') AS dia,
               COUNT(*) AS documentos,
               COALESCE(SUM(CASE WHEN tipo = 'NC' THEN -total ELSE total END), 0) AS total
        FROM faturas
        WHERE estado IN ${ESTADOS_VALIDOS} AND tipo IN ('FT','FR','ND','NC')
          AND (tipo <> 'NC' OR fatura_origem_id IS NULL
               OR fatura_origem_id NOT IN (SELECT fa.id FROM faturas fa WHERE fa.estado = 'anulada')) AND data_emissao >= :desde
        GROUP BY dia ORDER BY dia`, { desde }),

      consultar(`
        SELECT COALESCE(SUM(CASE WHEN tipo = 'NC' THEN -total ELSE total END), 0) AS total
        FROM faturas
        WHERE estado IN ${ESTADOS_VALIDOS} AND tipo IN ('FT','FR','ND','NC')
          AND (tipo <> 'NC' OR fatura_origem_id IS NULL
               OR fatura_origem_id NOT IN (SELECT fa.id FROM faturas fa WHERE fa.estado = 'anulada'))
          AND data_emissao >= :desdeAnterior AND data_emissao < :desde`, { desde, desdeAnterior }),

      consultar(`
        SELECT p.id, p.nome,
               COALESCE(SUM(fi.quantidade), 0) AS quantidade,
               COALESCE(SUM(fi.total_linha), 0) AS valor
        FROM fatura_itens fi
        JOIN faturas f ON f.id = fi.fatura_id
        JOIN produtos p ON p.id = fi.produto_id
        WHERE f.estado IN ${ESTADOS_VALIDOS} AND f.tipo IN ('FT','FR','ND') AND f.data_emissao >= :desde
        GROUP BY p.id, p.nome
        ORDER BY valor DESC
        LIMIT 5`, { desde }),

      Utilizador.count({ where: { ativo: true } }),
    ])

    const vendasPorDia = preencherDias(listaDias, vendas, ['total', 'documentos'])
    const totalVendas = dinheiro(vendasPorDia.reduce((s, d) => s + d.total, 0))
    const totalAnterior = dinheiro(anterior && anterior.total)
    const documentos = vendasPorDia.reduce((s, d) => s + d.documentos, 0)

    const custo = dinheiro(stock.custo)
    const venda = dinheiro(stock.venda)

    res.json({
      periodo: { dias, desde: listaDias[0], ate: listaDias[listaDias.length - 1] },
      kpis: {
        produtosAtivos: Number(stock.produtos),
        unidadesEmStock: Number(stock.unidades),
        valorStockCusto: custo,
        valorStockVenda: venda,
        margemPotencial: dinheiro(venda - custo),
        stockBaixo: Number(stock.baixo),
        semStock: Number(stock.sem_stock),
        utilizadoresAtivos,
        vendasPeriodo: totalVendas,
        vendasAnterior: totalAnterior,
        variacaoVendas: totalAnterior > 0
          ? Math.round(((totalVendas - totalAnterior) / totalAnterior) * 1000) / 10
          : null,
        documentos,
        ticketMedio: documentos > 0 ? dinheiro(totalVendas / documentos) : 0,
      },
      stockPorCategoria: porCategoria.map((c) => ({
        nome: c.nome,
        produtos: Number(c.produtos),
        unidades: Number(c.unidades),
        valor: dinheiro(c.valor),
      })),
      alertasStock: alertas.map((a) => ({
        id: a.id,
        nome: a.nome,
        categoria: a.categoria,
        quantidade: Number(a.quantidade),
        minimo: Number(a.minimo),
      })),
      movimentosPorDia: preencherDias(listaDias, movimentos, ['entradas', 'saidas']),
      vendasPorDia: vendasPorDia.map((d) => ({ ...d, total: dinheiro(d.total) })),
      topProdutos: topProdutos.map((p) => ({
        id: p.id,
        nome: p.nome,
        quantidade: Number(p.quantidade),
        valor: dinheiro(p.valor),
      })),
    })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao calcular a análise.')
  }
})

module.exports = router
