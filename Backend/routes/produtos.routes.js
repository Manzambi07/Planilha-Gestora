const express = require('express')
const { Op } = require('sequelize')
const {
  sequelize, Produto, Categoria, Fornecedor, TaxaIva, MovimentoStock,
} = require('../models')
const uploadFoto = require('../middleware/upload')
const { gerarQr, apagarUpload } = require('../utils/ficheiros')
const {
  ErroValidacao, tratarErro, texto, numero, idDaRota,
} = require('../utils/validacao')

const router = express.Router()

// Transforma o caminho guardado na BD (uploads/produtos/x.jpg) num URL completo
const urlPublica = (req, caminho) => {
  if (!caminho) return null
  if (/^https?:\/\//i.test(caminho)) return caminho
  const limpo = String(caminho).replace(/\\/g, '/').replace(/^\/+/, '')
  return `${req.protocol}://${req.get('host')}/${limpo}`
}

const incluir = [
  { model: Categoria, as: 'categoria', attributes: ['id', 'nome'] },
  { model: Fornecedor, as: 'fornecedor', attributes: ['id', 'nome'], required: false },
  { model: TaxaIva, as: 'taxaIva', attributes: ['descricao', 'percentagem'] },
]

// Formato que o frontend recebe
const formatar = (req, p) => ({
  id: p.id,
  codigo: p.codigo,
  codigoBarras: p.codigo_barras,
  nome: p.nome,
  categoria: p.categoria ? p.categoria.nome : null,
  fornecedor: p.fornecedor ? p.fornecedor.nome : null,
  preco: Number(p.preco_venda),
  iva: p.taxaIva
    ? { descricao: p.taxaIva.descricao, percentagem: Number(p.taxaIva.percentagem) }
    : null,
  unidade: p.unidade,
  quantidade: p.stock_atual,
  stockMinimo: p.stock_minimo,
  stockBaixo: p.stock_atual <= p.stock_minimo,
  foto: urlPublica(req, p.foto),
  qrToken: p.qr_token,
  qrImagem: urlPublica(req, p.qr_imagem),
})

// Valida o que veio do formulário (só estes campos entram; nada mais passa)
async function lerDados(body) {
  const dados = {
    nome: texto(body.nome, 'Nome', { max: 150, obrigatorio: true }),
    codigo: texto(body.codigo, 'Código', { max: 40 }),
    codigo_barras: texto(body.codigoBarras, 'Código de barras', { max: 40 }),
    descricao: texto(body.descricao, 'Descrição', { max: 2000 }),
    categoria_id: numero(body.categoriaId, 'Categoria', { min: 1, inteiro: true }),
    fornecedor_id: numero(body.fornecedorId, 'Fornecedor', {
      min: 1, inteiro: true, obrigatorio: false, padrao: null,
    }),
    taxa_iva_id: numero(body.taxaIvaId, 'IVA', { min: 1, inteiro: true }),
    preco_custo: numero(body.precoCusto, 'Preço de custo', { obrigatorio: false, padrao: 0 }),
    preco_venda: numero(body.precoVenda, 'Preço de venda'),
    stock_atual: numero(body.quantidade, 'Quantidade', { inteiro: true, max: 1000000000 }),
    stock_minimo: numero(body.stockMinimo, 'Stock mínimo', {
      inteiro: true, max: 1000000000, obrigatorio: false, padrao: 5,
    }),
    unidade: texto(body.unidade, 'Unidade', { max: 15 }) || 'un',
  }

  const [categoria, iva, fornecedor] = await Promise.all([
    Categoria.findOne({ where: { id: dados.categoria_id, ativo: true }, attributes: ['id'] }),
    TaxaIva.findOne({ where: { id: dados.taxa_iva_id, ativo: true }, attributes: ['id'] }),
    dados.fornecedor_id
      ? Fornecedor.findOne({ where: { id: dados.fornecedor_id, ativo: true }, attributes: ['id'] })
      : Promise.resolve(true),
  ])
  if (!categoria) throw new ErroValidacao('Categoria inválida.')
  if (!iva) throw new ErroValidacao('IVA inválido.')
  if (!fornecedor) throw new ErroValidacao('Fornecedor inválido.')

  return dados
}

// ---------------------------------------------------------------------------
// GET /api/produtos?busca=arroz&ordem=asc&pagina=1&limite=50
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim()
    const ordem = ['asc', 'desc'].includes(req.query.ordem) ? req.query.ordem : null
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), 200)

    const where = { ativo: true }

    // pesquisa por produto, categoria ou fornecedor (já ignora acentos e maiúsculas)
    if (busca) {
      const termo = `%${busca.replace(/[%_\\]/g, '\\$&')}%`
      where[Op.or] = [
        { nome: { [Op.like]: termo } },
        { '$categoria.nome$': { [Op.like]: termo } },
        { '$fornecedor.nome$': { [Op.like]: termo } },
      ]
    }

    const { count, rows } = await Produto.findAndCountAll({
      where,
      attributes: [
        'id', 'codigo', 'codigo_barras', 'nome', 'preco_venda',
        'stock_atual', 'stock_minimo', 'unidade', 'foto', 'qr_token', 'qr_imagem',
      ],
      include: incluir,
      order: ordem ? [['stock_atual', ordem], ['id', 'ASC']] : [['id', 'ASC']],
      limit: limite,
      offset: (pagina - 1) * limite,
      subQuery: false,
    })

    res.json({
      total: count,
      pagina,
      limite,
      produtos: rows.map((p) => formatar(req, p)),
    })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar produtos.')
  }
})

// ---------------------------------------------------------------------------
// GET /api/produtos/opcoes  -> listas para os selects do formulário
// (tem de ficar ANTES de /:id)
// ---------------------------------------------------------------------------
router.get('/opcoes', async (req, res) => {
  try {
    const [categorias, fornecedores, taxasIva] = await Promise.all([
      Categoria.findAll({ where: { ativo: true }, attributes: ['id', 'nome'], order: [['nome', 'ASC']] }),
      Fornecedor.findAll({ where: { ativo: true }, attributes: ['id', 'nome'], order: [['nome', 'ASC']] }),
      TaxaIva.findAll({ where: { ativo: true }, attributes: ['id', 'descricao', 'percentagem'], order: [['id', 'ASC']] }),
    ])
    res.json({ categorias, fornecedores, taxasIva })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao carregar as opções.')
  }
})

// ---------------------------------------------------------------------------
// GET /api/produtos/:id  -> dados completos para editar
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const p = await Produto.findOne({ where: { id, ativo: true }, include: incluir })
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' })

    res.json({
      produto: {
        ...formatar(req, p),
        descricao: p.descricao,
        precoCusto: Number(p.preco_custo),
        categoriaId: p.categoria_id,
        fornecedorId: p.fornecedor_id,
        taxaIvaId: p.taxa_iva_id,
      },
    })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao obter o produto.')
  }
})

// ---------------------------------------------------------------------------
// POST /api/produtos  (multipart/form-data, foto opcional no campo "foto")
// ---------------------------------------------------------------------------
router.post('/', uploadFoto, async (req, res) => {
  const foto = req.file ? `uploads/produtos/${req.file.filename}` : null
  let qrImagem = null
  let t

  try {
    const dados = await lerDados(req.body || {})

    t = await sequelize.transaction()
    const produto = await Produto.create({ ...dados, foto }, { transaction: t })

    // o token do QR foi criado automaticamente pelo model
    qrImagem = await gerarQr(produto.qr_token)
    await produto.update({ qr_imagem: qrImagem }, { transaction: t })

    if (dados.stock_atual > 0) {
      await MovimentoStock.create({
        produto_id: produto.id,
        tipo: 'entrada',
        quantidade: dados.stock_atual,
        stock_apos: dados.stock_atual,
        nota: 'Stock inicial',
      }, { transaction: t })
    }

    await t.commit()
    res.status(201).json({ id: produto.id })
  } catch (erro) {
    if (t) await t.rollback().catch(() => {})
    apagarUpload(foto)
    apagarUpload(qrImagem)
    tratarErro(res, erro, 'Erro ao criar o produto.')
  }
})

// ---------------------------------------------------------------------------
// PUT /api/produtos/:id  (multipart/form-data)
//   foto nova      -> campo "foto"
//   remover a foto -> campo removerFoto = "1"
// ---------------------------------------------------------------------------
router.put('/:id', uploadFoto, async (req, res) => {
  const novaFoto = req.file ? `uploads/produtos/${req.file.filename}` : null
  let t

  try {
    const id = idDaRota(req.params.id)
    const produto = await Produto.findOne({ where: { id, ativo: true } })
    if (!produto) {
      apagarUpload(novaFoto)
      return res.status(404).json({ erro: 'Produto não encontrado.' })
    }

    const dados = await lerDados(req.body || {})

    const fotoAntiga = produto.foto
    let foto = fotoAntiga
    if (novaFoto) foto = novaFoto
    else if (req.body.removerFoto === '1') foto = null

    // produtos antigos (sem QR) ganham o QR ao serem editados
    const qrImagem = produto.qr_imagem || (await gerarQr(produto.qr_token))
    const diferenca = dados.stock_atual - produto.stock_atual

    t = await sequelize.transaction()
    await produto.update({ ...dados, foto, qr_imagem: qrImagem }, { transaction: t })

    if (diferenca !== 0) {
      await MovimentoStock.create({
        produto_id: produto.id,
        tipo: 'ajuste',
        quantidade: diferenca,
        stock_apos: dados.stock_atual,
        nota: 'Ajuste manual na edição do produto',
      }, { transaction: t })
    }

    await t.commit()
    if (foto !== fotoAntiga) apagarUpload(fotoAntiga)
    res.json({ id })
  } catch (erro) {
    if (t) await t.rollback().catch(() => {})
    apagarUpload(novaFoto)
    tratarErro(res, erro, 'Erro ao editar o produto.')
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/produtos/:id
// Não apaga da BD (as faturas antigas continuam a referenciar o produto): fica inativo.
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const produto = await Produto.findOne({ where: { id, ativo: true } })
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' })

    await produto.update({ ativo: false })
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao eliminar o produto.')
  }
})

module.exports = router
