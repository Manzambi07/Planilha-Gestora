const express = require('express')
const { Op } = require('sequelize')
const {
  Empresa, TaxaIva, MetodoPagamento, Produto, Auditoria, Utilizador,
} = require('../models')
const { exigirPerfil } = require('../middleware/auth')
const uploadLogo = require('../middleware/uploadLogo')
const { apagarUpload } = require('../utils/ficheiros')
const {
  ErroValidacao, tratarErro, texto, numero, email, idDaRota,
} = require('../utils/validacao')
const { registar } = require('../utils/auditoria')

const router = express.Router()
const soAdmin = exigirPerfil('admin')

const urlPublica = (req, caminho) => {
  if (!caminho) return null
  const limpo = String(caminho).replace(/\\/g, '/').replace(/^\/+/, '')
  return `${req.protocol}://${req.get('host')}/${limpo}`
}

// ===========================================================================
// EMPRESA (uma única linha, id = 1)
// ===========================================================================
const formatarEmpresa = (req, e) => ({
  nome: e ? e.nome : '',
  nif: e ? e.nif : '',
  endereco: e ? e.endereco : '',
  telefone: e ? e.telefone : '',
  email: e ? e.email : '',
  moeda: e ? e.moeda : 'AOA',
  logotipo: e ? urlPublica(req, e.logotipo) : null,
})

// GET /api/definicoes/empresa  (qualquer utilizador com sessão)
router.get('/empresa', async (req, res) => {
  try {
    res.json({ empresa: formatarEmpresa(req, await Empresa.findByPk(1)) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao obter os dados da empresa.')
  }
})

// PUT /api/definicoes/empresa  (multipart; logotipo opcional; removerLogotipo = "1")
router.put('/empresa', soAdmin, uploadLogo, async (req, res) => {
  const novoLogo = req.file ? `uploads/empresa/${req.file.filename}` : null
  try {
    const body = req.body || {}
    const moeda = (texto(body.moeda, 'Moeda', { max: 3 }) || 'AOA').toUpperCase()
    if (!/^[A-Z]{3}$/.test(moeda)) throw new ErroValidacao('Moeda deve ter 3 letras (ex.: AOA).')

    const dados = {
      nome: texto(body.nome, 'Nome da empresa', { max: 150, obrigatorio: true }),
      nif: texto(body.nif, 'NIF', { max: 20, obrigatorio: true }),
      endereco: texto(body.endereco, 'Endereço', { max: 255 }),
      telefone: texto(body.telefone, 'Telefone', { max: 30 }),
      email: email(body.email),
      moeda,
    }

    const atual = await Empresa.findByPk(1)
    const logoAntigo = atual ? atual.logotipo : null
    let logotipo = logoAntigo
    if (novoLogo) logotipo = novoLogo
    else if (body.removerLogotipo === '1') logotipo = null

    if (atual) await atual.update({ ...dados, logotipo })
    else await Empresa.create({ id: 1, ...dados, logotipo })

    if (logotipo !== logoAntigo) apagarUpload(logoAntigo)
    await registar(req, 'editar', 'empresa', 1, dados)

    res.json({ empresa: formatarEmpresa(req, await Empresa.findByPk(1)) })
  } catch (erro) {
    apagarUpload(novoLogo)
    tratarErro(res, erro, 'Erro ao guardar os dados da empresa.')
  }
})

// ===========================================================================
// TAXAS DE IVA  (usa os campos nome/percentagem/motivo_isencao para o ModalGestao)
// ===========================================================================
const resumoIva = (t) => ({
  id: t.id,
  nome: t.descricao,
  percentagem: Number(t.percentagem),
  motivo_isencao: t.motivo_isencao,
})

const lerIva = (body) => {
  const percentagem = numero(body.percentagem, 'Percentagem', { min: 0, max: 100 })
  const motivo = texto(body.motivo_isencao, 'Motivo de isenção', { max: 150 })
  if (percentagem === 0 && !motivo) {
    throw new ErroValidacao('Uma taxa de 0% precisa do motivo de isenção.')
  }
  return {
    descricao: texto(body.nome, 'Nome', { max: 60, obrigatorio: true }),
    percentagem,
    motivo_isencao: percentagem === 0 ? motivo : null,
  }
}

router.get('/iva', async (req, res) => {
  try {
    const taxas = await TaxaIva.findAll({ where: { ativo: true }, order: [['id', 'ASC']] })
    res.json({ taxas: taxas.map(resumoIva) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar as taxas de IVA.')
  }
})

router.post('/iva', soAdmin, async (req, res) => {
  try {
    const dados = lerIva(req.body || {})
    const existente = await TaxaIva.findOne({ where: { descricao: dados.descricao } })
    if (existente && existente.ativo) {
      return res.status(409).json({ erro: 'Já existe uma taxa com este nome.' })
    }
    const taxa = existente
      ? await existente.update({ ...dados, ativo: true })
      : await TaxaIva.create(dados)
    await registar(req, 'criar', 'taxas_iva', taxa.id, dados)
    res.status(201).json({ taxa: resumoIva(taxa) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar a taxa de IVA.')
  }
})

router.put('/iva/:id', soAdmin, async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const taxa = await TaxaIva.findOne({ where: { id, ativo: true } })
    if (!taxa) return res.status(404).json({ erro: 'Taxa não encontrada.' })

    const dados = lerIva(req.body || {})
    const repetida = await TaxaIva.findOne({ where: { descricao: dados.descricao, id: { [Op.ne]: id } } })
    if (repetida) return res.status(409).json({ erro: 'Já existe uma taxa com este nome.' })

    await taxa.update(dados)
    await registar(req, 'editar', 'taxas_iva', id, dados)
    res.json({ taxa: resumoIva(taxa) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao editar a taxa de IVA.')
  }
})

router.delete('/iva/:id', soAdmin, async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const taxa = await TaxaIva.findOne({ where: { id, ativo: true } })
    if (!taxa) return res.status(404).json({ erro: 'Taxa não encontrada.' })

    const emUso = await Produto.count({ where: { taxa_iva_id: id, ativo: true } })
    if (emUso > 0) {
      return res.status(409).json({
        erro: `Não é possível eliminar: ${emUso} produto(s) usam esta taxa. Muda o IVA deles primeiro.`,
      })
    }
    await taxa.update({ ativo: false })
    await registar(req, 'desativar', 'taxas_iva', id)
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao eliminar a taxa de IVA.')
  }
})

// ===========================================================================
// MÉTODOS DE PAGAMENTO
// ===========================================================================
const resumoMetodo = (m) => ({ id: m.id, nome: m.nome })

router.get('/metodos-pagamento', async (req, res) => {
  try {
    const metodos = await MetodoPagamento.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] })
    res.json({ metodos: metodos.map(resumoMetodo) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar os métodos de pagamento.')
  }
})

router.post('/metodos-pagamento', soAdmin, async (req, res) => {
  try {
    const nome = texto((req.body || {}).nome, 'Nome', { max: 50, obrigatorio: true })
    const existente = await MetodoPagamento.findOne({ where: { nome } })
    if (existente && existente.ativo) {
      return res.status(409).json({ erro: 'Já existe um método com este nome.' })
    }
    const metodo = existente ? await existente.update({ ativo: true }) : await MetodoPagamento.create({ nome })
    await registar(req, 'criar', 'metodos_pagamento', metodo.id, { nome })
    res.status(201).json({ metodo: resumoMetodo(metodo) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar o método de pagamento.')
  }
})

router.put('/metodos-pagamento/:id', soAdmin, async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const metodo = await MetodoPagamento.findOne({ where: { id, ativo: true } })
    if (!metodo) return res.status(404).json({ erro: 'Método não encontrado.' })

    const nome = texto((req.body || {}).nome, 'Nome', { max: 50, obrigatorio: true })
    const repetido = await MetodoPagamento.findOne({ where: { nome, id: { [Op.ne]: id } } })
    if (repetido) return res.status(409).json({ erro: 'Já existe um método com este nome.' })

    await metodo.update({ nome })
    await registar(req, 'editar', 'metodos_pagamento', id, { nome })
    res.json({ metodo: resumoMetodo(metodo) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao editar o método de pagamento.')
  }
})

// Fica inativo (os pagamentos antigos continuam a apontar para ele)
router.delete('/metodos-pagamento/:id', soAdmin, async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const metodo = await MetodoPagamento.findOne({ where: { id, ativo: true } })
    if (!metodo) return res.status(404).json({ erro: 'Método não encontrado.' })

    await metodo.update({ ativo: false })
    await registar(req, 'desativar', 'metodos_pagamento', id)
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao eliminar o método de pagamento.')
  }
})

// ===========================================================================
// REGISTO DE ATIVIDADE (auditoria) - só admin
// GET /api/definicoes/atividade?pagina=1&limite=30&acao=&tabela=&utilizadorId=
// ===========================================================================
router.get('/atividade', soAdmin, async (req, res) => {
  try {
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 30, 1), 100)

    const where = {}
    if (req.query.acao) where.acao = String(req.query.acao).slice(0, 50)
    if (req.query.tabela) where.tabela = String(req.query.tabela).slice(0, 50)
    const uid = parseInt(req.query.utilizadorId, 10)
    if (uid > 0) where.utilizador_id = uid

    const { count, rows } = await Auditoria.findAndCountAll({
      where,
      include: [{ model: Utilizador, as: 'utilizador', attributes: ['id', 'nome'], required: false }],
      order: [['id', 'DESC']],
      limit: limite,
      offset: (pagina - 1) * limite,
    })

    res.json({
      total: count,
      pagina,
      limite,
      registos: rows.map((r) => ({
        id: r.id,
        quando: r.criado_em,
        utilizador: r.utilizador ? r.utilizador.nome : 'Sistema',
        acao: r.acao,
        tabela: r.tabela,
        registoId: r.registo_id,
        detalhes: r.detalhes,
        ip: r.ip,
      })),
    })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao carregar o registo de atividade.')
  }
})

// DELETE /api/definicoes/atividade?dias=90  -> apaga registos com mais de N dias (mínimo 30).
// Nunca apaga os registos de documentos fiscais (tabela "faturas"). A própria limpeza fica registada.
router.delete('/atividade', soAdmin, async (req, res) => {
  try {
    const dias = numero(req.query.dias, 'Dias', { min: 30, max: 3650, inteiro: true })
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
    const apagados = await Auditoria.destroy({
      where: { criado_em: { [Op.lt]: limite }, tabela: { [Op.ne]: 'faturas' } },
    })
    await registar(req, 'limpar_atividade', 'sistema', null, { maisAntigosQue: `${dias} dias`, apagados })
    res.json({ apagados })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao limpar o registo de atividade.')
  }
})

module.exports = router
