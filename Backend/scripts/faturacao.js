// Faturação: emitir, receber, anular e verificar documentos.
// Cada operação corre numa TRANSAÇÃO: ou fica tudo gravado (documento, itens, pagamentos,
// stock e número da série) ou não fica nada.
const { Op, fn, col } = require('sequelize')
const {
  sequelize, Empresa, Cliente, Produto, TaxaIva, SerieDocumento, MetodoPagamento,
  Fatura, FaturaItem, Pagamento, MovimentoStock, Utilizador,
} = require('../models')
const { ErroValidacao } = require('../utils/validacao')
const C = require('./calculos')

// true  = o preço de venda dos produtos já inclui IVA (preço de prateleira)
// false = o preço é sem IVA e o IVA soma-se
const PRECOS_COM_IVA = process.env.PRECOS_COM_IVA !== 'false'
const NIF_CONSUMIDOR_FINAL = process.env.NIF_CONSUMIDOR_FINAL || '999999999'
const PROGRAMA = {
  nome: 'Planilha Gestora',
  versao: '1.0',
  certificado: process.env.AGT_CERTIFICADO || null, // preencher só depois de a AGT validar o software
}

const NOMES_TIPO = { FT: 'Fatura', FR: 'Fatura-Recibo', NC: 'Nota de Crédito', ND: 'Nota de Débito', OR: 'Orçamento' }
const PERFIS_COM_DESCONTO = ['admin', 'gestor']
const MAX_LINHAS = 100

// Converte erros de cálculo em erros que o utilizador pode ler
const traduzir = (fn_) => {
  try { return fn_() } catch (e) {
    if (e instanceof C.ErroNegocio) throw new ErroValidacao(e.message)
    throw e
  }
}

const num = (v) => Number(v)

// ---------------------------------------------------------------- apoio
async function obterConsumidorFinal(t) {
  const [cliente] = await Cliente.findOrCreate({
    where: { nif: NIF_CONSUMIDOR_FINAL },
    defaults: { nome: 'Consumidor final' },
    transaction: t,
  })
  return cliente
}

async function exigirEmpresa(t) {
  const empresa = await Empresa.findByPk(1, { transaction: t })
  if (!empresa || !empresa.nome || !empresa.nif) {
    throw new ErroValidacao('Preencha os dados da empresa (nome e NIF) em Definições antes de emitir documentos.')
  }
  return empresa
}

// Reserva o próximo número da série (tipo + ano) e devolve também o hash do documento anterior.
// A linha da série fica BLOQUEADA até ao fim da transação: dois documentos nunca recebem o mesmo número.
async function reservarNumero(tipo, dataEmissao, t) {
  const ano = C.anoNoFuso(dataEmissao)
  await SerieDocumento.findOrCreate({ where: { tipo, ano }, defaults: { ultimo_numero: 0 }, transaction: t })
  const serie = await SerieDocumento.findOne({ where: { tipo, ano }, lock: t.LOCK.UPDATE, transaction: t })

  const numero = serie.ultimo_numero + 1
  const anterior = await Fatura.findOne({
    where: { serie_id: serie.id },
    order: [['numero', 'DESC']],
    attributes: ['hash_documento'],
    transaction: t,
  })
  await serie.update({ ultimo_numero: numero }, { transaction: t })

  return {
    serieId: serie.id,
    numero,
    numeroCompleto: C.formatarNumero(tipo, ano, numero),
    hashAnterior: anterior ? anterior.hash_documento : '',
  }
}

const agora = () => new Date(Math.floor(Date.now() / 1000) * 1000) // sem milissegundos (o hash usa segundos)

// ---------------------------------------------------------------- consultas para o ecrã de venda
const formatarProdutoVenda = (p, taxa, baseUrl) => ({
  id: p.id,
  nome: p.nome,
  codigo: p.codigo,
  codigoBarras: p.codigo_barras,
  unidade: p.unidade,
  preco: num(p.preco_venda),
  ivaPercentagem: taxa ? num(taxa.percentagem) : 0,
  ivaNome: taxa ? taxa.descricao : '',
  stock: p.stock_atual,
  foto: p.foto ? `${baseUrl}/${String(p.foto).replace(/\\/g, '/').replace(/^\/+/, '')}` : null,
})

async function comTaxas(produtos, baseUrl) {
  const taxas = await TaxaIva.findAll()
  const porId = new Map(taxas.map((t) => [t.id, t]))
  return produtos.map((p) => formatarProdutoVenda(p, porId.get(p.taxa_iva_id), baseUrl))
}

// Leitor de código de barras / QR: encontra o produto pelo que o leitor "escreveu"
async function produtoPorCodigo(codigo, baseUrl) {
  const c = String(codigo || '').trim()
  if (!c) throw new ErroValidacao('Código vazio.')
  const onde = c.toUpperCase().startsWith('PROD:')
    ? { qr_token: c.slice(5).trim() }
    : { [Op.or]: [{ codigo_barras: c }, { codigo: c }] }
  const produto = await Produto.findOne({ where: { ...onde, ativo: true } })
  if (!produto) return null
  return (await comTaxas([produto], baseUrl))[0]
}

async function pesquisarProdutos(busca, baseUrl) {
  const termo = `%${String(busca || '').trim().replace(/[%_\\]/g, '\\$&')}%`
  const produtos = await Produto.findAll({
    where: {
      ativo: true,
      [Op.or]: [{ nome: { [Op.iLike]: termo } }, { codigo: { [Op.iLike]: termo } }, { codigo_barras: { [Op.iLike]: termo } }],
    },
    order: [['nome', 'ASC']],
    limit: 12,
  })
  return comTaxas(produtos, baseUrl)
}

async function configuracao() {
  const empresa = await Empresa.findByPk(1)
  const consumidor = await Cliente.findOne({ where: { nif: NIF_CONSUMIDOR_FINAL } })
  return {
    precosComIva: PRECOS_COM_IVA,
    moeda: empresa ? empresa.moeda : 'AOA',
    empresaConfigurada: Boolean(empresa && empresa.nome && empresa.nif),
    consumidorFinal: consumidor
      ? { id: consumidor.id, nome: consumidor.nome, nif: consumidor.nif }
      : { id: null, nome: 'Consumidor final', nif: NIF_CONSUMIDOR_FINAL },
    programa: PROGRAMA,
  }
}

// ---------------------------------------------------------------- clientes
const formatarCliente = (c) => ({
  id: c.id, nome: c.nome, nif: c.nif, telefone: c.telefone, email: c.email, endereco: c.endereco,
})

async function listarClientes(busca) {
  const termo = `%${String(busca || '').trim().replace(/[%_\\]/g, '\\$&')}%`
  const clientes = await Cliente.findAll({
    where: { ativo: true, [Op.or]: [{ nome: { [Op.iLike]: termo } }, { nif: { [Op.iLike]: termo } }] },
    order: [['nome', 'ASC']],
    limit: 15,
  })
  return clientes.map(formatarCliente)
}

// ---------------------------------------------------------------- emitir
/**
 * dados: { tipo: 'FR'|'FT', clienteId?, itens:[{produtoId, quantidade, desconto}],
 *          pagamentos:[{metodoId, valor, referencia}], observacoes?, diasVencimento? }
 * Os preços e o IVA vêm SEMPRE da base de dados, nunca do que o navegador envia.
 */
async function emitirDocumento(dados, utilizador) {
  const { tipo, itens } = dados
  if (!['FR', 'FT'].includes(tipo)) throw new ErroValidacao('Tipo de documento inválido.')
  if (!Array.isArray(itens) || itens.length === 0) throw new ErroValidacao('Adicione pelo menos um produto.')
  if (itens.length > MAX_LINHAS) throw new ErroValidacao(`Um documento pode ter no máximo ${MAX_LINHAS} linhas.`)

  const ids = itens.map((i) => i.produtoId)
  if (new Set(ids).size !== ids.length) throw new ErroValidacao('Há produtos repetidos no documento.')
  if (itens.some((i) => i.desconto > 0) && !PERFIS_COM_DESCONTO.includes(utilizador.perfil)) {
    throw new ErroValidacao('Só administradores e gestores podem dar descontos.')
  }

  const t = await sequelize.transaction()
  try {
    const empresa = await exigirEmpresa(t)
    const dataEmissao = agora()

    // ---- cliente
    const consumidor = await obterConsumidorFinal(t)
    const cliente = dados.clienteId
      ? await Cliente.findOne({ where: { id: dados.clienteId, ativo: true }, transaction: t })
      : consumidor
    if (!cliente) throw new ErroValidacao('Cliente não encontrado.')
    if (tipo === 'FT' && (cliente.id === consumidor.id || !cliente.nif)) {
      throw new ErroValidacao('Uma fatura a crédito precisa de um cliente identificado, com NIF.')
    }

    // ---- produtos (bloqueados até ao fim: ninguém vende o mesmo stock ao mesmo tempo)
    const idsOrdenados = [...ids].sort((a, b) => a - b)
    const produtos = await Produto.findAll({
      where: { id: idsOrdenados }, order: [['id', 'ASC']], lock: t.LOCK.UPDATE, transaction: t,
    })
    const taxas = new Map((await TaxaIva.findAll({ transaction: t })).map((x) => [x.id, x]))
    const porId = new Map(produtos.map((p) => [p.id, p]))

    // ---- linhas
    const linhas = itens.map((item) => {
      const produto = porId.get(item.produtoId)
      if (!produto || !produto.ativo) throw new ErroValidacao('Um dos produtos já não está disponível.')
      if (produto.stock_atual < item.quantidade) {
        throw new ErroValidacao(`Stock insuficiente para "${produto.nome}" (disponível: ${produto.stock_atual}).`)
      }
      const taxa = taxas.get(produto.taxa_iva_id)
      if (!taxa) throw new ErroValidacao(`O produto "${produto.nome}" não tem taxa de IVA válida.`)

      const calculo = traduzir(() => C.calcularLinha({
        quantidade: item.quantidade,
        precoCentimos: C.paraCentimos(produto.preco_venda),
        descontoCentimos: C.paraCentimos(item.desconto || 0),
        ivaPercentagem: num(taxa.percentagem),
        precosComIva: PRECOS_COM_IVA,
      }))
      return { produto, taxa, quantidade: item.quantidade, calculo }
    })
    const totais = traduzir(() => C.somarDocumento(linhas.map((l) => l.calculo)))

    // ---- pagamentos (só nas faturas-recibo)
    let pagamentos = []
    let troco = 0
    if (tipo === 'FR') {
      const metodos = new Set((await MetodoPagamento.findAll({ where: { ativo: true }, transaction: t })).map((m) => m.id))
      const pedidos = (dados.pagamentos || []).map((p) => {
        if (!metodos.has(p.metodoId)) throw new ErroValidacao('Método de pagamento inválido.')
        return { metodoId: p.metodoId, valorCentimos: C.paraCentimos(p.valor), referencia: p.referencia || null }
      })
      const r = traduzir(() => C.distribuirPagamentos(totais.total, pedidos))
      pagamentos = r.pagamentos
      troco = r.troco
    }

    // ---- número da série e hash
    const reserva = await reservarNumero(tipo, dataEmissao, t)
    const hash = C.calcularHash({
      dataEmissao, numeroCompleto: reserva.numeroCompleto, totalCentimos: totais.total, hashAnterior: reserva.hashAnterior,
    })

    let vencimento = null
    if (tipo === 'FT') {
      const dias = Number.isInteger(dados.diasVencimento) ? dados.diasVencimento : 30
      // data de vencimento no calendário de Angola (UTC+1)
      vencimento = new Date(dataEmissao.getTime() + 3600 * 1000 + dias * 86400000).toISOString().slice(0, 10)
    }

    const fatura = await Fatura.create({
      serie_id: reserva.serieId,
      numero: reserva.numero,
      numero_completo: reserva.numeroCompleto,
      tipo,
      cliente_id: cliente.id,
      utilizador_id: utilizador.id,
      data_emissao: dataEmissao,
      data_vencimento: vencimento,
      subtotal: C.deCentimos(totais.subtotal),
      desconto_total: C.deCentimos(totais.descontoTotal),
      iva_total: C.deCentimos(totais.iva),
      total: C.deCentimos(totais.total),
      estado: tipo === 'FR' ? 'paga' : 'emitida',
      hash_documento: hash,
      observacoes: dados.observacoes || null,
    }, { transaction: t })

    await FaturaItem.bulkCreate(linhas.map((l) => ({
      fatura_id: fatura.id,
      produto_id: l.produto.id,
      descricao: l.produto.nome,
      quantidade: l.quantidade,
      preco_unitario: num(l.produto.preco_venda),
      desconto: C.deCentimos(l.calculo.desconto),
      iva_percentagem: num(l.taxa.percentagem),
      iva_valor: C.deCentimos(l.calculo.iva),
      total_linha: C.deCentimos(l.calculo.totalLinha),
    })), { transaction: t })

    if (pagamentos.length) {
      await Pagamento.bulkCreate(pagamentos.map((p) => ({
        fatura_id: fatura.id,
        metodo_id: p.metodoId,
        valor: C.deCentimos(p.valorCentimos),
        referencia: p.referencia,
        data_pagamento: dataEmissao,
        utilizador_id: utilizador.id,
      })), { transaction: t })
    }

    // ---- stock
    for (const l of linhas) {
      const novo = l.produto.stock_atual - l.quantidade
      await l.produto.update({ stock_atual: novo }, { transaction: t })
      await MovimentoStock.create({
        produto_id: l.produto.id, tipo: 'venda', quantidade: -l.quantidade, stock_apos: novo,
        fatura_id: fatura.id, utilizador_id: utilizador.id, nota: reserva.numeroCompleto,
      }, { transaction: t })
    }

    await t.commit()
    return { id: fatura.id, numero: reserva.numeroCompleto, troco: C.deCentimos(troco), empresa: empresa.nome }
  } catch (erro) {
    await t.rollback()
    throw erro
  }
}

// ---------------------------------------------------------------- receber pagamento de uma fatura
async function registarPagamento(faturaId, pedidos, utilizador) {
  const t = await sequelize.transaction()
  try {
    const fatura = await Fatura.findByPk(faturaId, { lock: t.LOCK.UPDATE, transaction: t })
    if (!fatura) throw new ErroValidacao('Documento não encontrado.')
    if (!['FT', 'ND'].includes(fatura.tipo) || !['emitida', 'parcial'].includes(fatura.estado)) {
      throw new ErroValidacao('Este documento não tem pagamentos em falta.')
    }

    const [{ pago }] = await Pagamento.findAll({
      where: { fatura_id: fatura.id }, attributes: [[fn('COALESCE', fn('SUM', col('valor')), 0), 'pago']], raw: true, transaction: t,
    })
    const saldo = C.paraCentimos(fatura.total) - C.paraCentimos(pago)

    const metodos = new Set((await MetodoPagamento.findAll({ where: { ativo: true }, transaction: t })).map((m) => m.id))
    const lista = (pedidos || []).map((p) => {
      if (!metodos.has(p.metodoId)) throw new ErroValidacao('Método de pagamento inválido.')
      return { metodoId: p.metodoId, valorCentimos: C.paraCentimos(p.valor), referencia: p.referencia || null }
    })
    if (lista.length === 0 || lista.some((p) => p.valorCentimos <= 0)) {
      throw new ErroValidacao('Indique um valor maior que zero.')
    }

    const recebido = lista.reduce((s, p) => s + p.valorCentimos, 0)
    let aGravar = lista
    let troco = 0
    if (recebido >= saldo) {
      const r = traduzir(() => C.distribuirPagamentos(saldo, lista))
      aGravar = r.pagamentos
      troco = r.troco
    }

    const quando = agora()
    await Pagamento.bulkCreate(aGravar.map((p) => ({
      fatura_id: fatura.id, metodo_id: p.metodoId, valor: C.deCentimos(p.valorCentimos),
      referencia: p.referencia, data_pagamento: quando, utilizador_id: utilizador.id,
    })), { transaction: t })

    const gravado = aGravar.reduce((s, p) => s + p.valorCentimos, 0)
    await fatura.update({ estado: gravado >= saldo ? 'paga' : 'parcial' }, { transaction: t })

    await t.commit()
    return { id: fatura.id, numero: fatura.numero_completo, troco: C.deCentimos(troco) }
  } catch (erro) {
    await t.rollback()
    throw erro
  }
}

// ---------------------------------------------------------------- anular (Nota de Crédito total)
async function anularDocumento(faturaId, motivoBruto, utilizador) {
  const motivo = String(motivoBruto || '').trim()
  if (motivo.length < 3) throw new ErroValidacao('Indique o motivo da anulação.')
  if (motivo.length > 255) throw new ErroValidacao('O motivo não pode ter mais de 255 caracteres.')

  const t = await sequelize.transaction()
  try {
    const empresa = await exigirEmpresa(t)
    const original = await Fatura.findByPk(faturaId, { lock: t.LOCK.UPDATE, transaction: t })
    if (!original) throw new ErroValidacao('Documento não encontrado.')
    if (!['FT', 'FR'].includes(original.tipo) || !['emitida', 'paga', 'parcial'].includes(original.estado)) {
      throw new ErroValidacao('Este documento não pode ser anulado.')
    }
    if (await Fatura.count({ where: { fatura_origem_id: original.id, tipo: 'NC' }, transaction: t }) > 0) {
      throw new ErroValidacao('Este documento já tem uma nota de crédito.')
    }

    const itens = await FaturaItem.findAll({ where: { fatura_id: original.id }, order: [['id', 'ASC']], transaction: t })
    const ids = itens.map((i) => i.produto_id).sort((a, b) => a - b)
    const produtos = await Produto.findAll({ where: { id: ids }, order: [['id', 'ASC']], lock: t.LOCK.UPDATE, transaction: t })
    const porId = new Map(produtos.map((p) => [p.id, p]))

    const dataEmissao = agora()
    const reserva = await reservarNumero('NC', dataEmissao, t)
    const hash = C.calcularHash({
      dataEmissao, numeroCompleto: reserva.numeroCompleto, totalCentimos: C.paraCentimos(original.total), hashAnterior: reserva.hashAnterior,
    })

    const nota = await Fatura.create({
      serie_id: reserva.serieId,
      numero: reserva.numero,
      numero_completo: reserva.numeroCompleto,
      tipo: 'NC',
      cliente_id: original.cliente_id,
      utilizador_id: utilizador.id,
      fatura_origem_id: original.id,
      data_emissao: dataEmissao,
      subtotal: original.subtotal,
      desconto_total: original.desconto_total,
      iva_total: original.iva_total,
      total: original.total,
      estado: 'emitida',
      motivo_anulacao: motivo,
      hash_documento: hash,
      observacoes: `Anulação de ${original.numero_completo}`,
    }, { transaction: t })

    await FaturaItem.bulkCreate(itens.map((i) => ({
      fatura_id: nota.id, produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade,
      preco_unitario: i.preco_unitario, desconto: i.desconto, iva_percentagem: i.iva_percentagem,
      iva_valor: i.iva_valor, total_linha: i.total_linha,
    })), { transaction: t })

    for (const i of itens) {
      const produto = porId.get(i.produto_id)
      const novo = produto.stock_atual + Math.round(num(i.quantidade))
      await produto.update({ stock_atual: novo }, { transaction: t })
      await MovimentoStock.create({
        produto_id: produto.id, tipo: 'devolucao', quantidade: Math.round(num(i.quantidade)), stock_apos: novo,
        fatura_id: nota.id, utilizador_id: utilizador.id, nota: `Anulação de ${original.numero_completo}`,
      }, { transaction: t })
    }

    await original.update({ estado: 'anulada', motivo_anulacao: motivo }, { transaction: t })

    await t.commit()
    return { id: nota.id, numero: reserva.numeroCompleto, original: original.numero_completo, empresa: empresa.nome }
  } catch (erro) {
    await t.rollback()
    throw erro
  }
}

// ---------------------------------------------------------------- consultar
async function listarDocumentos(filtros) {
  const pagina = Math.max(parseInt(filtros.pagina, 10) || 1, 1)
  const limite = Math.min(Math.max(parseInt(filtros.limite, 10) || 20, 1), 100)

  const where = {}
  if (['FT', 'FR', 'NC', 'ND'].includes(filtros.tipo)) where.tipo = filtros.tipo
  if (['emitida', 'paga', 'parcial', 'anulada'].includes(filtros.estado)) where.estado = filtros.estado
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(filtros.desde || '') ? `${filtros.desde} 00:00:00` : null
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(filtros.ate || '') ? `${filtros.ate} 23:59:59` : null
  if (desde && ate) where.data_emissao = { [Op.between]: [desde, ate] }
  else if (desde) where.data_emissao = { [Op.gte]: desde }
  else if (ate) where.data_emissao = { [Op.lte]: ate }

  const busca = String(filtros.busca || '').trim()
  if (busca) {
    const termo = `%${busca.replace(/[%_\\]/g, '\\$&')}%`
    where[Op.or] = [
      { numero_completo: { [Op.iLike]: termo } },
      { '$cliente.nome$': { [Op.iLike]: termo } },
      { '$cliente.nif$': { [Op.iLike]: termo } },
    ]
  }

  const { count, rows } = await Fatura.findAndCountAll({
    where,
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nome', 'nif'], required: false },
      { model: Utilizador, as: 'emitidaPor', attributes: ['id', 'nome'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: limite,
    offset: (pagina - 1) * limite,
    subQuery: false,
  })

  const pagos = rows.length
    ? await Pagamento.findAll({
      where: { fatura_id: rows.map((r) => r.id) },
      attributes: ['fatura_id', [fn('SUM', col('valor')), 'pago']],
      group: ['fatura_id'],
      raw: true,
    })
    : []
  const pagoPorFatura = new Map(pagos.map((p) => [p.fatura_id, num(p.pago)]))

  return {
    total: count,
    pagina,
    limite,
    documentos: rows.map((f) => ({
      id: f.id,
      numero: f.numero_completo,
      tipo: f.tipo,
      tipoNome: NOMES_TIPO[f.tipo],
      estado: f.estado,
      dataEmissao: f.data_emissao,
      dataVencimento: f.data_vencimento,
      cliente: f.cliente ? { id: f.cliente.id, nome: f.cliente.nome, nif: f.cliente.nif } : null,
      emitidaPor: f.emitidaPor ? f.emitidaPor.nome : null,
      total: num(f.total),
      pago: pagoPorFatura.get(f.id) || 0,
    })),
  }
}

async function obterDocumento(id, baseUrl) {
  const f = await Fatura.findByPk(id, {
    include: [
      { model: Cliente, as: 'cliente' },
      { model: Utilizador, as: 'emitidaPor', attributes: ['id', 'nome'] },
      { model: FaturaItem, as: 'itens' },
      { model: Pagamento, as: 'pagamentos', include: [{ model: MetodoPagamento, as: 'metodo', attributes: ['nome'] }] },
      { model: Fatura, as: 'faturaOrigem', attributes: ['id', 'numero_completo', 'tipo'] },
      { model: Fatura, as: 'notasRelacionadas', attributes: ['id', 'numero_completo', 'tipo'] },
    ],
    order: [[{ model: FaturaItem, as: 'itens' }, 'id', 'ASC'], [{ model: Pagamento, as: 'pagamentos' }, 'id', 'ASC']],
  })
  if (!f) return null

  const empresa = await Empresa.findByPk(1)
  const pago = f.pagamentos.reduce((s, p) => s + C.paraCentimos(p.valor), 0)
  const logo = empresa && empresa.logotipo
    ? `${baseUrl}/${String(empresa.logotipo).replace(/\\/g, '/').replace(/^\/+/, '')}`
    : null

  return {
    id: f.id,
    tipo: f.tipo,
    tipoNome: NOMES_TIPO[f.tipo],
    numero: f.numero_completo,
    estado: f.estado,
    dataEmissao: f.data_emissao,
    dataVencimento: f.data_vencimento,
    cliente: f.cliente
      ? { id: f.cliente.id, nome: f.cliente.nome, nif: f.cliente.nif, endereco: f.cliente.endereco, telefone: f.cliente.telefone }
      : null,
    emitidaPor: f.emitidaPor ? f.emitidaPor.nome : null,
    origem: f.faturaOrigem ? { id: f.faturaOrigem.id, numero: f.faturaOrigem.numero_completo } : null,
    notas: f.notasRelacionadas.map((n) => ({ id: n.id, numero: n.numero_completo, tipo: n.tipo })),
    itens: f.itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      quantidade: num(i.quantidade),
      precoUnitario: num(i.preco_unitario),
      desconto: num(i.desconto),
      ivaPercentagem: num(i.iva_percentagem),
      ivaValor: num(i.iva_valor),
      totalLinha: num(i.total_linha),
    })),
    pagamentos: f.pagamentos.map((p) => ({
      id: p.id, metodo: p.metodo ? p.metodo.nome : '', valor: num(p.valor), referencia: p.referencia, data: p.data_pagamento,
    })),
    pago: C.deCentimos(pago),
    saldo: ['FT', 'ND'].includes(f.tipo) && ['emitida', 'parcial'].includes(f.estado)
      ? C.deCentimos(C.paraCentimos(f.total) - pago) : 0,
    subtotal: num(f.subtotal),
    descontoTotal: num(f.desconto_total),
    ivaTotal: num(f.iva_total),
    total: num(f.total),
    hash: f.hash_documento,
    observacoes: f.observacoes,
    motivoAnulacao: f.motivo_anulacao,
    precosComIva: PRECOS_COM_IVA,
    empresa: empresa
      ? { nome: empresa.nome, nif: empresa.nif, endereco: empresa.endereco, telefone: empresa.telefone, email: empresa.email, moeda: empresa.moeda, logotipo: logo }
      : null,
    programa: PROGRAMA,
  }
}

// ---------------------------------------------------------------- integridade
// Recalcula a cadeia de hashes de cada série e procura buracos na numeração.
async function verificarIntegridade() {
  const series = await SerieDocumento.findAll({ order: [['ano', 'ASC'], ['tipo', 'ASC']] })
  const resultado = []

  for (const serie of series) {
    const docs = await Fatura.findAll({
      where: { serie_id: serie.id },
      attributes: ['numero', 'numero_completo', 'data_emissao', 'total', 'hash_documento'],
      order: [['numero', 'ASC']],
    })

    let anterior = ''
    let esperado = 1
    let problema = null
    for (const d of docs) {
      if (d.numero !== esperado) { problema = { numero: d.numero_completo, motivo: `Falta o número ${esperado} na série.` }; break }
      const certo = C.calcularHash({
        dataEmissao: d.data_emissao, numeroCompleto: d.numero_completo,
        totalCentimos: C.paraCentimos(d.total), hashAnterior: anterior,
      })
      if (certo !== d.hash_documento) { problema = { numero: d.numero_completo, motivo: 'O hash não corresponde: o documento foi alterado.' }; break }
      anterior = d.hash_documento
      esperado += 1
    }
    resultado.push({ serie: `${serie.tipo} ${serie.ano}`, documentos: docs.length, ok: !problema, problema })
  }
  return { ok: resultado.every((r) => r.ok), series: resultado }
}

module.exports = {
  configuracao, produtoPorCodigo, pesquisarProdutos, listarClientes, formatarCliente,
  emitirDocumento, registarPagamento, anularDocumento, listarDocumentos, obterDocumento, verificarIntegridade,
  PERFIS_COM_DESCONTO,
}
