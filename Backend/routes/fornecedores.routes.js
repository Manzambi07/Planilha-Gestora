const express = require('express')
const { Fornecedor, Produto } = require('../models')
const { tratarErro, texto, email, idDaRota } = require('../utils/validacao')

const router = express.Router()

const lerDados = (body) => ({
  nome: texto(body.nome, 'Nome', { max: 150, obrigatorio: true }),
  nif: texto(body.nif, 'NIF', { max: 20 }),
  telefone: texto(body.telefone, 'Telefone', { max: 30 }),
  email: email(body.email),
  endereco: texto(body.endereco, 'Endereço', { max: 255 }),
})

const resumo = (f) => ({
  id: f.id,
  nome: f.nome,
  nif: f.nif,
  telefone: f.telefone,
  email: f.email,
  endereco: f.endereco,
})

// GET /api/fornecedores
router.get('/', async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      where: { ativo: true },
      attributes: ['id', 'nome', 'nif', 'telefone', 'email', 'endereco'],
      order: [['nome', 'ASC']],
    })
    res.json({ fornecedores })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar fornecedores.')
  }
})

// POST /api/fornecedores
router.post('/', async (req, res) => {
  try {
    const dados = lerDados(req.body || {})

    // se já existiu e foi eliminado, reativa em vez de dar erro de nome repetido
    const existente = await Fornecedor.findOne({ where: { nome: dados.nome } })
    if (existente && existente.ativo) {
      return res.status(409).json({ erro: 'Já existe um fornecedor com este nome.' })
    }
    const fornecedor = existente
      ? await existente.update({ ...dados, ativo: true })
      : await Fornecedor.create(dados)

    res.status(201).json({ fornecedor: resumo(fornecedor) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar fornecedor.')
  }
})

// PUT /api/fornecedores/:id
router.put('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const fornecedor = await Fornecedor.findOne({ where: { id, ativo: true } })
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })

    await fornecedor.update(lerDados(req.body || {}))
    res.json({ fornecedor: resumo(fornecedor) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao editar fornecedor.')
  }
})

// DELETE /api/fornecedores/:id  (fica inativo; não apaga da BD)
router.delete('/:id', async (req, res) => {
  try {
    const id = idDaRota(req.params.id)
    const fornecedor = await Fornecedor.findOne({ where: { id, ativo: true } })
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })

    const emUso = await Produto.count({ where: { fornecedor_id: id, ativo: true } })
    if (emUso > 0) {
      return res.status(409).json({
        erro: `Não é possível eliminar: ${emUso} produto(s) usam este fornecedor. Muda o fornecedor deles primeiro.`,
      })
    }

    await fornecedor.update({ ativo: false })
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao eliminar fornecedor.')
  }
})

module.exports = router
