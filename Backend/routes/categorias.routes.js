const express = require('express')
const { Categoria, Produto } = require('../models')
const { tratarErro, texto, idDaRota } = require('../utils/validacao')

const router = express.Router()

const lerDados = (body) => ({
  nome: texto(body.nome, 'Nome', { max: 100, obrigatorio: true }),
  descricao: texto(body.descricao, 'Descrição', { max: 255 }),
})

const resumo = (c) => ({ id: c.id, nome: c.nome, descricao: c.descricao })

// GET /api/categorias
router.get('/', async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      where: { ativo: true },
      attributes: ['id', 'nome', 'descricao'],
      order: [['nome', 'ASC']],
    })
    res.json({ categorias })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar categorias.')
  }
})

// POST /api/categorias  { nome, descricao }
router.post('/', async (req, res) => {
  try {
    const dados = lerDados(req.body || {})

    // se já existiu e foi eliminada, reativa em vez de dar erro de nome repetido
    const existente = await Categoria.findOne({ where: { nome: dados.nome } })
    if (existente && existente.ativo) {
      return res.status(409).json({ erro: 'Já existe uma categoria com este nome.' })
    }
    const categoria = existente
      ? await existente.update({ ...dados, ativo: true })
      : await Categoria.create(dados)

    res.status(201).json({ categoria: resumo(categoria) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar categoria.')
  }
})

// PUT /api/categorias/:id
router.put('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const categoria = await Categoria.findOne({ where: { id, ativo: true } })
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' })

    await categoria.update(lerDados(req.body || {}))
    res.json({ categoria: resumo(categoria) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao editar categoria.')
  }
})

// DELETE /api/categorias/:id  (fica inativa; não apaga da BD)
router.delete('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const categoria = await Categoria.findOne({ where: { id, ativo: true } })
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' })

    const emUso = await Produto.count({ where: { categoria_id: id, ativo: true } })
    if (emUso > 0) {
      return res.status(409).json({
        erro: `Não é possível eliminar: ${emUso} produto(s) usam esta categoria. Muda a categoria deles primeiro.`,
      })
    }

    await categoria.update({ ativo: false })
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao eliminar categoria.')
  }
})

module.exports = router
