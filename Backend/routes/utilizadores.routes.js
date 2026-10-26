// Só admin chega aqui (a proteção está no server.js)
const express = require('express')
const { Op, fn, col } = require('sequelize')
const { Utilizador } = require('../models')
const {
  ErroValidacao, tratarErro, texto, email, idDaRota,
} = require('../utils/validacao')
const { validarSenha, hashSenha, senhaTemporaria } = require('../utils/senha')
const { registar } = require('../utils/auditoria')

const router = express.Router()
const PERFIS = ['admin', 'gestor', 'vendedor']

const resumo = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  perfil: u.perfil,
  ativo: u.ativo,
  ultimoLogin: u.ultimo_login,
  criadoEm: u.criado_em,
  bloqueado: Boolean(u.bloqueado_ate && u.bloqueado_ate > new Date()),
})

const lerDados = (body) => {
  const mail = email(body.email)
  if (!mail) throw new ErroValidacao('Email é obrigatório.')
  const perfil = String(body.perfil || '')
  if (!PERFIS.includes(perfil)) throw new ErroValidacao('Perfil inválido.')
  return {
    nome: texto(body.nome, 'Nome', { max: 120, obrigatorio: true }),
    email: mail.toLowerCase(),
    perfil,
  }
}

const procurar = async (idTexto) => {
  const id = idDaRota(idTexto)
  const u = await Utilizador.findByPk(id)
  return u
}

// Nunca deixar o sistema sem nenhum administrador ativo
const eUltimoAdmin = async (u) => {
  if (u.perfil !== 'admin' || !u.ativo) return false
  const outros = await Utilizador.count({
    where: { perfil: 'admin', ativo: true, id: { [Op.ne]: u.id } },
  })
  return outros === 0
}

// GET /api/utilizadores?busca=&perfil=&estado=ativo|inativo&pagina=1&limite=20
router.get('/', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim()
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 100)

    const where = {}
    if (PERFIS.includes(req.query.perfil)) where.perfil = req.query.perfil
    if (req.query.estado === 'ativo') where.ativo = true
    if (req.query.estado === 'inativo') where.ativo = false
    if (busca) {
      const termo = `%${busca.replace(/[%_\\]/g, '\\$&')}%`
      where[Op.or] = [{ nome: { [Op.like]: termo } }, { email: { [Op.like]: termo } }]
    }

    const [{ count, rows }, contagem] = await Promise.all([
      Utilizador.findAndCountAll({
        where,
        order: [['ativo', 'DESC'], ['nome', 'ASC']],
        limit: limite,
        offset: (pagina - 1) * limite,
      }),
      Utilizador.findAll({
        attributes: ['perfil', 'ativo', [fn('COUNT', col('id')), 'n']],
        group: ['perfil', 'ativo'],
        raw: true,
      }),
    ])

    const totais = { admin: 0, gestor: 0, vendedor: 0, ativos: 0, inativos: 0 }
    contagem.forEach((c) => {
      const n = Number(c.n)
      if (c.ativo) { totais[c.perfil] += n; totais.ativos += n } else totais.inativos += n
    })

    res.json({ total: count, pagina, limite, totais, utilizadores: rows.map(resumo) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao listar utilizadores.')
  }
})

// GET /api/utilizadores/:id
router.get('/:id', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })
    res.json({ utilizador: resumo(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao obter o utilizador.')
  }
})

// POST /api/utilizadores  { nome, email, perfil, senha }
router.post('/', async (req, res) => {
  try {
    const body = req.body || {}
    const dados = lerDados(body)
    validarSenha(body.senha)

    if (await Utilizador.findOne({ where: { email: dados.email } })) {
      return res.status(409).json({ erro: 'Já existe um utilizador com este email.' })
    }

    const u = await Utilizador.create({ ...dados, senha_hash: await hashSenha(body.senha) })
    await registar(req, 'criar', 'utilizadores', u.id, { email: u.email, perfil: u.perfil })
    res.status(201).json({ utilizador: resumo(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao criar utilizador.')
  }
})

// PUT /api/utilizadores/:id  { nome, email, perfil }
router.put('/:id', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })

    const dados = lerDados(req.body || {})

    if (dados.perfil !== u.perfil) {
      if (u.id === req.utilizador.id) {
        throw new ErroValidacao('Não podes alterar o teu próprio perfil.')
      }
      if (dados.perfil !== 'admin' && (await eUltimoAdmin(u))) {
        return res.status(409).json({ erro: 'Tem de existir pelo menos um administrador ativo.' })
      }
    }

    const repetido = await Utilizador.findOne({
      where: { email: dados.email, id: { [Op.ne]: u.id } },
    })
    if (repetido) return res.status(409).json({ erro: 'Já existe um utilizador com este email.' })

    const antes = { nome: u.nome, email: u.email, perfil: u.perfil }
    await u.update(dados)
    await registar(req, 'editar', 'utilizadores', u.id, { antes, depois: dados })
    res.json({ utilizador: resumo(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao editar utilizador.')
  }
})

// DELETE /api/utilizadores/:id  -> desativa (as faturas e movimentos antigos continuam a apontar para ele)
router.delete('/:id', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u || !u.ativo) return res.status(404).json({ erro: 'Utilizador não encontrado.' })

    if (u.id === req.utilizador.id) {
      throw new ErroValidacao('Não podes desativar a tua própria conta.')
    }
    if (await eUltimoAdmin(u)) {
      return res.status(409).json({ erro: 'Tem de existir pelo menos um administrador ativo.' })
    }

    await u.update({ ativo: false })
    await registar(req, 'desativar', 'utilizadores', u.id, { email: u.email })
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao desativar utilizador.')
  }
})

// POST /api/utilizadores/:id/reativar
router.post('/:id/reativar', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })

    await u.update({ ativo: true, tentativas_login: 0, bloqueado_ate: null })
    await registar(req, 'reativar', 'utilizadores', u.id, { email: u.email })
    res.json({ utilizador: resumo(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao reativar utilizador.')
  }
})

// POST /api/utilizadores/:id/desbloquear
router.post('/:id/desbloquear', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })

    await u.update({ tentativas_login: 0, bloqueado_ate: null })
    await registar(req, 'desbloquear', 'utilizadores', u.id, { email: u.email })
    res.json({ utilizador: resumo(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao desbloquear utilizador.')
  }
})

// POST /api/utilizadores/:id/redefinir-senha  { novaSenha? }
// Sem novaSenha gera uma senha temporária e devolve-a UMA vez para o admin a entregar.
router.post('/:id/redefinir-senha', async (req, res) => {
  try {
    const u = await procurar(req.params.id)
    if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })

    const informada = (req.body || {}).novaSenha
    const nova = informada ? validarSenha(informada, 'Nova senha') : senhaTemporaria()

    await u.update({
      senha_hash: await hashSenha(nova),
      tentativas_login: 0,
      bloqueado_ate: null,
    })
    await registar(req, 'redefinir_senha', 'utilizadores', u.id, { email: u.email })
    res.json(informada ? { ok: true } : { ok: true, senhaTemporaria: nova })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao redefinir a senha.')
  }
})

module.exports = router
