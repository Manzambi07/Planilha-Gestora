const jwt = require('jsonwebtoken')
const { Utilizador } = require('../models')

const SEGREDO = process.env.JWT_SECRET
if (!SEGREDO || SEGREDO.length < 32) {
  throw new Error('Define JWT_SECRET no .env (mínimo 32 caracteres).')
}
const VALIDADE = process.env.JWT_VALIDADE || '8h'

const gerarToken = (u) =>
  jwt.sign({ sub: u.id, perfil: u.perfil }, SEGREDO, { algorithm: 'HS256', expiresIn: VALIDADE })

// Exige sessão válida. Vai à BD em cada pedido, por isso desativar um utilizador
// ou mudar-lhe o perfil tem efeito imediato (não espera o token expirar).
async function exigirLogin(req, res, next) {
  const [tipo, token] = String(req.headers.authorization || '').split(' ')
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Inicia sessão para continuar.' })
  }

  let dados
  try {
    dados = jwt.verify(token, SEGREDO, { algorithms: ['HS256'] })
  } catch {
    return res.status(401).json({ erro: 'A sessão expirou. Inicia sessão novamente.' })
  }

  try {
    const u = await Utilizador.findOne({ where: { id: dados.sub, ativo: true } })
    if (!u) return res.status(401).json({ erro: 'Conta inexistente ou desativada.' })
    req.utilizador = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil }
    next()
  } catch (erro) {
    console.error('Erro na autenticação:', erro.message)
    res.status(500).json({ erro: 'Erro ao validar a sessão.' })
  }
}

// exigirPerfil('admin', 'gestor') -> só estes perfis passam (usar depois de exigirLogin)
const exigirPerfil = (...perfis) => (req, res, next) => {
  if (req.utilizador && perfis.includes(req.utilizador.perfil)) return next()
  res.status(403).json({ erro: 'Não tens permissão para esta ação.' })
}

// GET passa para qualquer utilizador com sessão; alterar exige um destes perfis
const escritaPara = (...perfis) => {
  const guarda = exigirPerfil(...perfis)
  return (req, res, next) => (req.method === 'GET' ? next() : guarda(req, res, next))
}

module.exports = { gerarToken, exigirLogin, exigirPerfil, escritaPara }
