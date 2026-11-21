// Exportação do SAF-T (AO), versão 1.01_01 (esquema oficial da AGT).
// Ficheiro de FATURAÇÃO (TaxAccountingBasis = "F"): cabeçalho, clientes, produtos, tabela de impostos
// e documentos de venda (FT, FR, NC, ND).
//
// Duas partes:
//   construirSaft()  PURA: recebe dados simples e devolve o XML (fácil de testar, sem base de dados)
//   exportarSaft()   lê a base de dados, converte e chama construirSaft()
//
// Validar o resultado contra o XSD oficial:
//   xmllint --noout --schema SAFTAO1.01_01.xsd ficheiro.xml
//
// Variáveis de ambiente usadas (além das de assinatura.js):
//   PRODUTORA_NOME, PRODUTORA_NIF   entidade que produz o software (obrigatórias no cabeçalho)
//   AGT_CERTIFICADO                 número de validação do software (ex.: 123/AGT/2026); vazio = "0"
//   SAFT_ISENCAO_CODIGO             código de isenção (M10, M04...) para linhas com IVA 0%
//   PRECOS_COM_IVA                  igual ao do serviço de faturação
const C = require('./calculos')
const { dataAngola, instanteAngola } = require('./assinatura')

class ErroSaft extends Error {}

const NAMESPACE = 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01'
const TIPOS_EXPORTADOS = ['FT', 'FR', 'NC', 'ND']

// Motivos de isenção (esquema: código Mxx + texto de 6 a 60 caracteres). Lista oficial:
// https://github.com/assoft-portugal/SAF-T-AO/wiki/Tax-Exemption-Codes
const MOTIVOS_ISENCAO = {
  M02: 'Transmissão de bens e serviços não sujeita',
  M04: 'IVA – Regime de Exclusão',
  M10: 'Isento nos termos da alínea a) do nº1 do artigo 12.º',
  M11: 'Isento nos termos da alínea b) do nº1 do artigo 12.º',
  M12: 'Isento nos termos da alínea c) do nº1 do artigo 12.º',
  M13: 'Isento nos termos da alínea d) do nº1 do artigo 12.º',
  M20: 'Isento nos termos da alínea k) do nº1 do artigo 12.º',
  M21: 'Isento nos termos da alínea l) do nº1 do artigo 12.º',
  M22: 'Isento nos termos da alínea m) do artigo 12.º',
}

// ---------------------------------------------------------------- apoio ao XML
const esc = (v) => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const el = (nome, valor) => `<${nome}>${esc(valor)}</${nome}>`
const bloco = (nome, ...filhos) => `<${nome}>${filhos.filter(Boolean).join('')}</${nome}>`

// texto obrigatório: corta no limite do esquema e usa um valor por defeito se vier vazio
const txt = (v, max, defeito = 'Desconhecido') => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim()
  return (t || defeito).slice(0, max)
}
const txtOpcional = (nome, v, max) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim()
  return t ? el(nome, t.slice(0, max)) : ''
}

const dinheiro = (centimos) => (centimos / 100).toFixed(2)

// decimal com no mínimo 2 e no máximo 6 casas (preço unitário e quantidade)
const decimal = (n, minimo = 2, maximo = 6) => {
  let t = Number(n).toFixed(maximo)
  while (t.endsWith('0') && t.split('.')[1].length > minimo) t = t.slice(0, -1)
  return t
}

// ---------------------------------------------------------------- regras fiscais
const codigoTaxa = (pct) => (pct === 0 ? 'ISE' : pct >= 14 ? 'NOR' : 'RED')

function meioDePagamento(nome) {
  const n = String(nome || '').toLowerCase()
  if (/dinheiro|numer/.test(n)) return 'NU'
  if (/multicaixa|express|tpa|refer/.test(n)) return 'MB'
  if (/transfer|iban|banc/.test(n)) return 'TB'
  if (/d[eé]bito/.test(n)) return 'CD'
  if (/cart[aã]o|cr[eé]dito/.test(n)) return 'CC'
  return 'OU'
}

// "FR 2026/4" -> tipo "FR", série "2026", número 4. O esquema exige: [^ ]+ [^/ ]+/[0-9]+
const PADRAO_NUMERO = /^[^ ]+ [^/ ]+\/[0-9]+$/

// O número de validação do esquema tem a forma NNN/AGT/AAAA (ou "0").
// "FE/323/AGT/2026" (certificado de faturação eletrónica) -> "323/AGT/2026".
function numeroDeValidacao(certificado) {
  const m = String(certificado || '').match(/(\d+)\/AGT\/(\d{4})/)
  return m ? `${m[1]}/AGT/${m[2]}` : '0'
}

function linhaDoDocumento(doc, item, i, ctx) {
  const pct = Number(item.ivaPct)
  const liquidoC = item.totalLinhaC - item.ivaC // valor da linha sem IVA, já com desconto
  // o desconto guardado inclui IVA quando os preços de venda já incluem IVA
  const descontoLiquidoC = ctx.precosComIva ? Math.round(item.descontoC / (1 + pct / 100)) : item.descontoC
  const brutoLiquidoC = liquidoC + descontoLiquidoC
  const quantidade = Number(item.quantidade)
  const precoUnitario = brutoLiquidoC / 100 / quantidade
  const ehNota = doc.tipo === 'NC'

  let isencao = ''
  if (pct === 0) {
    const codigo = ctx.isencaoCodigo
    if (!/^M\d{2}$/.test(codigo || '')) {
      throw new ErroSaft(
        `O documento ${doc.numero} tem linhas com IVA 0%. Defina SAFT_ISENCAO_CODIGO (ex.: M10) com o código de isenção correto.`,
      )
    }
    isencao = el('TaxExemptionReason', txt(MOTIVOS_ISENCAO[codigo] || `Isenção ${codigo}`, 60)) + el('TaxExemptionCode', codigo)
  }

  return bloco(
    'Line',
    el('LineNumber', i + 1),
    el('ProductCode', ctx.codigoProduto(item.produtoId)),
    el('ProductDescription', txt(item.descricao, 200)),
    el('Quantity', decimal(quantidade, 2, 4)),
    el('UnitOfMeasure', txt(ctx.unidade(item.produtoId), 20, 'UN')),
    el('UnitPrice', decimal(precoUnitario)),
    el('TaxPointDate', dataAngola(doc.dataEmissao)),
    ehNota ? bloco('References', el('Reference', txt(doc.origemNumero, 60)), txtOpcional('Reason', doc.motivo, 50)) : '',
    el('Description', txt(item.descricao, 200)),
    // vendas creditam a receita; notas de crédito debitam-na
    el(ehNota ? 'DebitAmount' : 'CreditAmount', dinheiro(liquidoC)),
    bloco(
      'Tax',
      el('TaxType', 'IVA'),
      el('TaxCountryRegion', 'AO'),
      el('TaxCode', codigoTaxa(pct)),
      el('TaxPercentage', decimal(pct, 2, 2)),
    ),
    isencao,
    descontoLiquidoC > 0 ? el('SettlementAmount', dinheiro(descontoLiquidoC)) : '',
  )
}

function faturaXml(doc, ctx, totais) {
  if (!PADRAO_NUMERO.test(doc.numero)) {
    throw new ErroSaft(`O número "${doc.numero}" não cumpre o formato do SAF-T (tipo, espaço, série/número).`)
  }
  if (!doc.itens.length) throw new ErroSaft(`O documento ${doc.numero} não tem linhas.`)

  // uma fatura "anulada" só é estado A se não existir nota de crédito; com nota de crédito continua
  // a ser um documento normal (N), corrigido pela nota, senão a anulação contava duas vezes
  const estadoA = doc.estado === 'anulada' && !doc.temNotaCredito
  const status = estadoA ? 'A' : 'N'
  const assinado = Boolean(doc.assinatura) && ctx.validado

  if (status === 'N') {
    const liquidoC = doc.itens.reduce((s, it) => s + (it.totalLinhaC - it.ivaC), 0)
    if (doc.tipo === 'NC') totais.debitoC += liquidoC
    else totais.creditoC += liquidoC
  }

  return bloco(
    'Invoice',
    el('InvoiceNo', doc.numero),
    bloco(
      'DocumentStatus',
      el('InvoiceStatus', status),
      el('InvoiceStatusDate', instanteAngola(estadoA ? doc.atualizadoEm : doc.dataEmissao)),
      estadoA ? txtOpcional('Reason', doc.motivo, 50) : '',
      el('SourceID', txt(doc.utilizadorId, 30)),
      el('SourceBilling', 'P'),
    ),
    el('Hash', doc.assinatura || doc.hash),
    el('HashControl', assinado ? String(doc.chaveVersao || 1) : '0'),
    el('Period', Number(dataAngola(doc.dataEmissao).slice(5, 7))),
    el('InvoiceDate', dataAngola(doc.dataEmissao)),
    el('InvoiceType', doc.tipo),
    bloco('SpecialRegimes', el('SelfBillingIndicator', 0), el('CashVATSchemeIndicator', 0), el('ThirdPartiesBillingIndicator', 0)),
    el('SourceID', txt(doc.utilizadorId, 30)),
    el('SystemEntryDate', instanteAngola(doc.dataEmissao)),
    el('CustomerID', txt(doc.clienteId, 30)),
    ...doc.itens.map((item, i) => linhaDoDocumento(doc, item, i, ctx)),
    bloco(
      'DocumentTotals',
      el('TaxPayable', dinheiro(doc.ivaC)),
      el('NetTotal', dinheiro(doc.subtotalC)),
      el('GrossTotal', dinheiro(doc.totalC)),
      ...(doc.pagamentos || []).map((p) => bloco(
        'Payment',
        el('PaymentMechanism', meioDePagamento(p.metodo)),
        el('PaymentAmount', dinheiro(p.valorC)),
        el('PaymentDate', dataAngola(p.data)),
      )),
    ),
  )
}

// ---------------------------------------------------------------- construção do ficheiro (pura)
/**
 * @param {object} d
 *  empresa     { nome, nif, registoComercial?, endereco, cidade?, telefone?, email? }
 *  produtora   { nome, nif }
 *  programa    { nome, versao, certificado }
 *  periodo     { inicio:'AAAA-MM-DD', fim:'AAAA-MM-DD' }
 *  criadoEm    Date
 *  documentos  [{ numero, tipo, estado, dataEmissao, atualizadoEm, utilizadorId, hash, assinatura, chaveVersao,
 *                 clienteId, origemNumero, motivo, temNotaCredito, subtotalC, ivaC, totalC,
 *                 itens:[{ produtoId, descricao, quantidade, descontoC, ivaPct, ivaC, totalLinhaC }],
 *                 pagamentos:[{ metodo, valorC, data }] }]   (valores em CÊNTIMOS)
 *  clientes    [{ id, nome, nif, endereco, telefone, email }]
 *  produtos    [{ id, codigo, codigoBarras, nome, unidade }]
 *  taxas       [{ percentagem, descricao }]
 *  precosComIva, isencaoCodigo
 */
function construirSaft(d) {
  if (!d.produtora || !d.produtora.nome || !d.produtora.nif) {
    throw new ErroSaft('Defina PRODUTORA_NOME e PRODUTORA_NIF (entidade que produz o software) no ambiente do servidor.')
  }
  if (!d.empresa || !d.empresa.nome || String(d.empresa.nif || '').length < 10) {
    throw new ErroSaft('Preencha o nome e o NIF da empresa (10 ou mais caracteres) em Definições.')
  }

  // código de produto único (o esquema exige que cada código apareça uma só vez)
  const codigos = new Map()
  const usados = new Set()
  for (const p of d.produtos) {
    let codigo = txt(p.codigo, 60, '')
    if (!codigo || usados.has(codigo)) codigo = `P${p.id}`
    usados.add(codigo)
    codigos.set(p.id, codigo)
  }
  const porId = new Map(d.produtos.map((p) => [p.id, p]))
  const ctx = {
    precosComIva: d.precosComIva,
    isencaoCodigo: d.isencaoCodigo,
    validado: numeroDeValidacao(d.programa.certificado) !== '0',
    codigoProduto: (id) => codigos.get(id) || 'SEM-PRODUTO',
    unidade: (id) => (porId.get(id) ? porId.get(id).unidade : 'UN'),
  }

  const totais = { creditoC: 0, debitoC: 0 }
  const documentos = d.documentos.map((doc) => faturaXml(doc, ctx, totais))

  // tabela de impostos: as taxas configuradas + qualquer taxa usada nas linhas
  const taxas = new Map()
  for (const t of d.taxas) taxas.set(Number(t.percentagem), t.descricao)
  for (const doc of d.documentos) for (const it of doc.itens) if (!taxas.has(Number(it.ivaPct))) taxas.set(Number(it.ivaPct), null)

  const empresa = d.empresa
  const anoFiscal = Number(d.periodo.inicio.slice(0, 4))
  const faltaProduto = d.documentos.some((doc) => doc.itens.some((it) => !codigos.has(it.produtoId)))

  const cabecalho = bloco(
    'Header',
    el('AuditFileVersion', '1.01_01'),
    el('CompanyID', txt(empresa.registoComercial || empresa.nif, 50)),
    el('TaxRegistrationNumber', txt(empresa.nif, 15)),
    el('TaxAccountingBasis', 'F'),
    el('CompanyName', txt(empresa.nome, 200)),
    bloco(
      'CompanyAddress',
      el('AddressDetail', txt(empresa.endereco, 250)),
      el('City', txt(empresa.cidade, 50)),
      el('Country', 'AO'),
    ),
    el('FiscalYear', anoFiscal),
    el('StartDate', d.periodo.inicio),
    el('EndDate', d.periodo.fim),
    el('CurrencyCode', 'AOA'),
    el('DateCreated', dataAngola(d.criadoEm)),
    el('TaxEntity', 'Global'),
    el('ProductCompanyTaxID', txt(d.produtora.nif, 20)),
    el('SoftwareValidationNumber', numeroDeValidacao(d.programa.certificado)),
    // formato exigido: «Nome da aplicação/Nome da empresa produtora»; a barra só pode aparecer uma vez
    el('ProductID', `${txt(d.programa.nome, 120).replace(/\//g, '-')}/${txt(d.produtora.nome, 120).replace(/\//g, '-')}`),
    el('ProductVersion', txt(d.programa.versao, 30)),
    txtOpcional('Telephone', empresa.telefone, 20),
    txtOpcional('Email', empresa.email, 255),
  )

  const clientes = d.clientes.map((c) => bloco(
    'Customer',
    el('CustomerID', txt(c.id, 30)),
    el('AccountID', 'Desconhecido'),
    el('CustomerTaxID', txt(c.nif, 30, '999999999')),
    el('CompanyName', txt(c.nome, 200, 'Consumidor final')),
    bloco('BillingAddress', el('AddressDetail', txt(c.endereco, 250)), el('City', 'Desconhecido'), el('Country', 'AO')),
    txtOpcional('Telephone', c.telefone, 20),
    txtOpcional('Email', c.email, 255),
    el('SelfBillingIndicator', 0),
  ))

  const produtos = d.produtos.map((p) => bloco(
    'Product',
    el('ProductType', 'P'),
    el('ProductCode', codigos.get(p.id)),
    el('ProductDescription', txt(p.nome, 200)),
    el('ProductNumberCode', txt(p.codigoBarras || codigos.get(p.id), 60)),
  ))
  if (faltaProduto) {
    produtos.push(bloco('Product', el('ProductType', 'O'), el('ProductCode', 'SEM-PRODUTO'),
      el('ProductDescription', 'Linha sem produto associado'), el('ProductNumberCode', 'SEM-PRODUTO')))
  }

  const tabelaImpostos = bloco(
    'TaxTable',
    ...[...taxas.entries()].sort((a, b) => b[0] - a[0]).map(([pct, descricao]) => bloco(
      'TaxTableEntry',
      el('TaxType', 'IVA'),
      el('TaxCountryRegion', 'AO'),
      el('TaxCode', codigoTaxa(pct)),
      el('Description', txt(descricao, 255, `IVA ${pct}%`)),
      el('TaxPercentage', decimal(pct, 2, 2)),
    )),
  )

  const vendas = bloco(
    'SalesInvoices',
    el('NumberOfEntries', d.documentos.length),
    el('TotalDebit', dinheiro(totais.debitoC)),
    el('TotalCredit', dinheiro(totais.creditoC)),
    ...documentos,
  )

  return `<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="${NAMESPACE}">`
    + cabecalho
    + bloco('MasterFiles', ...clientes, ...produtos, tabelaImpostos)
    + bloco('SourceDocuments', vendas)
    + '</AuditFile>\n'
}

// ---------------------------------------------------------------- leitura da base de dados
const DATA = /^\d{4}-\d{2}-\d{2}$/

// por defeito: o mês corrente (no calendário de Angola)
function periodoPedido(desde, ate) {
  if (!desde && !ate) {
    const hoje = dataAngola(new Date())
    const [a, m] = hoje.split('-').map(Number)
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
    return { inicio: `${a}-${String(m).padStart(2, '0')}-01`, fim: `${a}-${String(m).padStart(2, '0')}-${ultimo}` }
  }
  if (!DATA.test(desde || '') || !DATA.test(ate || '')) throw new ErroSaft('Indique as datas no formato AAAA-MM-DD (desde e ate).')
  if (desde > ate) throw new ErroSaft('A data inicial não pode ser depois da final.')
  if (desde.slice(0, 4) !== ate.slice(0, 4)) throw new ErroSaft('O período tem de estar dentro do mesmo ano.')
  return { inicio: desde, fim: ate }
}

async function exportarSaft({ desde, ate } = {}) {
  const { Op } = require('sequelize')
  const {
    Empresa, Cliente, Produto, TaxaIva, Fatura, FaturaItem, Pagamento, MetodoPagamento,
  } = require('../models')

  const periodo = periodoPedido(desde, ate)
  const faturas = await Fatura.findAll({
    where: {
      tipo: { [Op.in]: TIPOS_EXPORTADOS },
      estado: { [Op.ne]: 'rascunho' },
      data_emissao: { [Op.between]: [`${periodo.inicio} 00:00:00`, `${periodo.fim} 23:59:59`] },
    },
    include: [
      { model: FaturaItem, as: 'itens' },
      { model: Pagamento, as: 'pagamentos', include: [{ model: MetodoPagamento, as: 'metodo', attributes: ['nome'] }] },
      { model: Fatura, as: 'faturaOrigem', attributes: ['numero_completo'] },
    ],
    order: [['id', 'ASC']],
  })

  const idsFaturas = faturas.map((f) => f.id)
  const comNota = new Set(
    (await Fatura.findAll({ where: { tipo: 'NC', fatura_origem_id: idsFaturas }, attributes: ['fatura_origem_id'] }))
      .map((n) => n.fatura_origem_id),
  )

  const idsClientes = [...new Set(faturas.map((f) => f.cliente_id))]
  const idsProdutos = [...new Set(faturas.flatMap((f) => f.itens.map((i) => i.produto_id)).filter(Boolean))]
  const [empresa, clientes, produtos, taxas] = await Promise.all([
    Empresa.findByPk(1),
    Cliente.findAll({ where: { id: idsClientes } }),
    Produto.findAll({ where: { id: idsProdutos } }),
    TaxaIva.findAll(),
  ])

  const programa = {
    nome: 'Planilha Gestora',
    versao: '1.0',
    certificado: process.env.AGT_CERTIFICADO || null,
  }

  const xml = construirSaft({
    empresa: empresa && {
      nome: empresa.nome, nif: empresa.nif, endereco: empresa.endereco, cidade: empresa.cidade,
      telefone: empresa.telefone, email: empresa.email, registoComercial: empresa.registo_comercial,
    },
    produtora: { nome: process.env.PRODUTORA_NOME, nif: process.env.PRODUTORA_NIF },
    programa,
    periodo,
    criadoEm: new Date(),
    precosComIva: process.env.PRECOS_COM_IVA !== 'false',
    isencaoCodigo: process.env.SAFT_ISENCAO_CODIGO,
    taxas: taxas.map((t) => ({ percentagem: Number(t.percentagem), descricao: t.descricao })),
    clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, nif: c.nif, endereco: c.endereco, telefone: c.telefone, email: c.email })),
    produtos: produtos.map((p) => ({ id: p.id, codigo: p.codigo, codigoBarras: p.codigo_barras, nome: p.nome, unidade: p.unidade })),
    documentos: faturas.map((f) => ({
      numero: f.numero_completo,
      tipo: f.tipo,
      estado: f.estado,
      dataEmissao: f.data_emissao,
      atualizadoEm: f.atualizado_em,
      utilizadorId: f.utilizador_id,
      hash: f.hash_documento,
      assinatura: f.assinatura,
      chaveVersao: f.chave_versao,
      clienteId: f.cliente_id,
      origemNumero: f.faturaOrigem ? f.faturaOrigem.numero_completo : null,
      motivo: f.motivo_anulacao,
      temNotaCredito: comNota.has(f.id),
      subtotalC: C.paraCentimos(f.subtotal),
      ivaC: C.paraCentimos(f.iva_total),
      totalC: C.paraCentimos(f.total),
      itens: [...f.itens].sort((a, b) => a.id - b.id).map((i) => ({
        produtoId: i.produto_id,
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        descontoC: C.paraCentimos(i.desconto),
        ivaPct: Number(i.iva_percentagem),
        ivaC: C.paraCentimos(i.iva_valor),
        totalLinhaC: C.paraCentimos(i.total_linha),
      })),
      pagamentos: [...f.pagamentos].sort((a, b) => a.id - b.id).map((p) => ({
        metodo: p.metodo ? p.metodo.nome : '',
        valorC: C.paraCentimos(p.valor),
        data: p.data_pagamento,
      })),
    })),
  })

  const nif = String(empresa.nif).replace(/\W/g, '')
  return {
    xml,
    nomeFicheiro: `SAFT-AO_${nif}_${periodo.inicio.replace(/-/g, '')}_${periodo.fim.replace(/-/g, '')}.xml`,
    resumo: { documentos: faturas.length, ...periodo },
  }
}

module.exports = { construirSaft, exportarSaft, numeroDeValidacao, ErroSaft }
