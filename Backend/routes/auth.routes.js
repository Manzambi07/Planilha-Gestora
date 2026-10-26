const express = require('express')
const rateLimit = require('express-rate-limit')
const bcrypt = require('bcrypt')
const { Utilizador } = require('../models')
const { gerarToken, exigirLogin } = require('../middleware/auth')
const { ErroValidacao, tratarErro, texto } = require('../utils/validacao')
const { validarSenha, hashSenha, compararSenha } = require('../utils/senha')
const { registar } = require('../utils/auditoria')

const router = express.Router()

const MAX_TENTATIVAS = 5
const BLOQUEIO_MINUTOS = 15

// hash de uma senha qualquer: serve para gastar o mesmo tempo quando o email não existe
const HASH_FALSO = bcrypt.hashSync('senha-falsa-123', 12)

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.' },
})

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil })

// POST /api/auth/login  { email, senha }
router.post('/login', limitarLogin, async (req, res) => {
  try {
    const email = texto((req.body || {}).email, 'Email', { max: 150, obrigatorio: true }).toLowerCase()
    const senha = (req.body || {}).senha
    if (typeof senha !== 'string' || !senha) throw new ErroValidacao('Senha é obrigatória.')

    const u = await Utilizador.scope('comSenha').findOne({ where: { email } })

    if (u && u.bloqueado_ate && u.bloqueado_ate > new Date()) {
      const hora = u.bloqueado_ate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      return res.status(423).json({ erro: `Conta bloqueada por tentativas falhadas. Tenta novamente às ${hora}.` })
    }

    const correta = await compararSenha(senha, u ? u.senha_hash : HASH_FALSO)

    if (!u || !correta) {
      if (u) {
        const tentativas = u.tentativas_login + 1
        if (tentativas >= MAX_TENTATIVAS) {
          await u.update({
            tentativas_login: 0,
            bloqueado_ate: new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000),
          })
        } else {
          await u.update({ tentativas_login: tentativas })
        }
      }
      return res.status(401).json({ erro: 'Email ou senha incorretos.' })
    }

    if (!u.ativo) {
      return res.status(403).json({ erro: 'Esta conta está desativada. Fala com o administrador.' })
    }

    await u.update({ tentativas_login: 0, bloqueado_ate: null, ultimo_login: new Date() })
    req.utilizador = { id: u.id }
    await registar(req, 'login', 'utilizadores', u.id)

    res.json({ token: gerarToken(u), utilizador: publico(u) })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao iniciar sessão.')
  }
})

// GET /api/auth/me  -> quem sou eu (o frontend usa para validar a sessão guardada)
router.get('/me', exigirLogin, (req, res) => {
  res.json({ utilizador: req.utilizador })
})

// POST /api/auth/alterar-senha  { senhaAtual, novaSenha }
router.post('/alterar-senha', exigirLogin, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body || {}
    validarSenha(novaSenha, 'Nova senha')

    const u = await Utilizador.scope('comSenha').findByPk(req.utilizador.id)
    if (!(await compararSenha(senhaAtual, u.senha_hash))) {
      return res.status(400).json({ erro: 'A senha atual está incorreta.' })
    }
    if (senhaAtual === novaSenha) {
      throw new ErroValidacao('A nova senha tem de ser diferente da atual.')
    }

    await u.update({ senha_hash: await hashSenha(novaSenha) })
    await registar(req, 'alterar_senha', 'utilizadores', u.id)
    res.json({ ok: true })
  } catch (erro) {
    tratarErro(res, erro, 'Erro ao alterar a senha.')
  }
})

module.exports = router
