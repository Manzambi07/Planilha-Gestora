// Montada em /api/faturacao (o server.js já exige sessão).
const express = require('express')
const { exigirPerfil } = require('../middleware/auth')
const servico = require('../services/faturacao')
const { registar } = require('../utils/auditoria')
const {
  ErroValidacao, tratarErro, texto, numero, email, idDaRota,
} = require('../utils/validacao')
const { Cliente } = require('../models')

const router = express.Router()
const baseUrl = (req) => `${req.protocol}://${req.get('host')}`

// ------------------------------------------------------------ ecrã de venda
// GET /api/faturacao/config
router.get('/config', async (req, res) => {
  try {
    res.json(await servico.configuracao())
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao carregar a configuração.')
  }
})

// GET /api/faturacao/produto?codigo=...   <- o leitor de código de barras / QR chama isto
router.get('/produto', async (req, res) => {
  try {
    const produto = await servico.produtoPorCodigo(req.query.codigo, baseUrl(req))
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' })
    res.json({ produto })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao procurar o produto.')
  }
})

// GET /api/faturacao/produtos?busca=...   <- pesquisa pelo nome
router.get('/produtos', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim()
    if (busca.length < 2) return res.json({ produtos: [] })
    res.json({ produtos: await servico.pesquisarProdutos(busca, baseUrl(req)) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao pesquisar produtos.')
  }
})

// ------------------------------------------------------------ clientes
router.get('/clientes', async (req, res) => {
  try {
    res.json({ clientes: await servico.listarClientes(req.query.busca) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar clientes.')
  }
})

router.post('/clientes', async (req, res) => {
  try {
    const body = req.body || {}
    const nif = texto(body.nif, 'NIF', { max: 20 })
    if (nif && (await Cliente.findOne({ where: { nif } }))) {
      return res.status(409).json({ erro: 'Já existe um cliente com este NIF.' })
    }
    const cliente = await Cliente.create({
      nome: texto(body.nome, 'Nome', { max: 150, obrigatorio: true }),
      nif,
      telefone: texto(body.telefone, 'Telefone', { max: 30 }),
      email: email(body.email),
      endereco: texto(body.endereco, 'Endereço', { max: 255 }),
    })
    await registar(req, 'criar', 'clientes', cliente.id, { nome: cliente.nome, nif: cliente.nif })
    res.status(201).json({ cliente: servico.formatarCliente(cliente) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar o cliente.')
  }
})

// ------------------------------------------------------------ documentos
const lerItens = (lista) => {
  if (!Array.isArray(lista)) throw new ErroValidacao('Adicione pelo menos um produto.')
  return lista.map((i) => ({
    produtoId: numero((i || {}).produtoId, 'Produto', { min: 1, inteiro: true }),
    quantidade: numero((i || {}).quantidade, 'Quantidade', { min: 1, max: 100000, inteiro: true }),
    desconto: numero((i || {}).desconto, 'Desconto', { min: 0, obrigatorio: false, padrao: 0 }),
  }))
}

const lerPagamentos = (lista) => (Array.isArray(lista) ? lista : []).map((p) => ({
  metodoId: numero((p || {}).metodoId, 'Método de pagamento', { min: 1, inteiro: true }),
  valor: numero((p || {}).valor, 'Valor do pagamento', { min: 0.01 }),
  referencia: texto((p || {}).referencia, 'Referência', { max: 100 }),
}))

// POST /api/faturacao/documentos  -> emite FR (paga na hora) ou FT (a crédito)
router.post('/documentos', async (req, res) => {
  try {
    const body = req.body || {}
    const dias = numero(body.diasVencimento, 'Dias de vencimento', { min: 0, max: 365, inteiro: true, obrigatorio: false, padrao: 30 })

    const feito = await servico.emitirDocumento({
      tipo: String(body.tipo || ''),
      clienteId: body.clienteId ? numero(body.clienteId, 'Cliente', { min: 1, inteiro: true }) : null,
      itens: lerItens(body.itens),
      pagamentos: lerPagamentos(body.pagamentos),
      observacoes: texto(body.observacoes, 'Observações', { max: 500 }),
      diasVencimento: dias,
    }, req.utilizador)

    await registar(req, 'emitir', 'faturas', feito.id, { numero: feito.numero })
    const documento = await servico.obterDocumento(feito.id, baseUrl(req))
    res.status(201).json({ documento, troco: feito.troco })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao emitir o documento.')
  }
})

// GET /api/faturacao/documentos?busca=&tipo=&estado=&desde=&ate=&pagina=
router.get('/documentos', async (req, res) => {
  try {
    res.json(await servico.listarDocumentos(req.query))
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar documentos.')
  }
})

router.get('/documentos/:id', async (req, res) => {
  try {
    const documento = await servico.obterDocumento(idDaRota(req.params.id), baseUrl(req))
    if (!documento) return res.status(404).json({ erro: 'Documento não encontrado.' })
    res.json({ documento })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao obter o documento.')
  }
})

// POST /api/faturacao/documentos/:id/pagamentos  -> receber (parte de) uma fatura a crédito
router.post('/documentos/:id/pagamentos', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const feito = await servico.registarPagamento(id, lerPagamentos((req.body || {}).pagamentos), req.utilizador)
    await registar(req, 'receber_pagamento', 'faturas', id, { numero: feito.numero })
    res.json({ documento: await servico.obterDocumento(id, baseUrl(req)), troco: feito.troco })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao registar o pagamento.')
  }
})

// POST /api/faturacao/documentos/:id/anular  { motivo }  -> emite Nota de Crédito (admin e gestor)
router.post('/documentos/:id/anular', exigirPerfil('admin', 'gestor'), async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const feito = await servico.anularDocumento(id, (req.body || {}).motivo, req.utilizador)
    await registar(req, 'anular', 'faturas', id, { nota: feito.numero, original: feito.original })
    res.json({ documento: await servico.obterDocumento(id, baseUrl(req)), nota: feito.numero })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao anular o documento.')
  }
})

// GET /api/faturacao/integridade  -> confere hashes e numeração (só admin)
router.get('/integridade', exigirPerfil('admin'), async (req, res) => {
  try {
    res.json(await servico.verificarIntegridade())
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao verificar a integridade.')
  }
})

module.exports = router
