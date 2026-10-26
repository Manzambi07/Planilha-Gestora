// Cria o primeiro administrador (ou mais um, se precisares).
// Executar dentro da pasta Backend:
//   node scripts/criarAdmin.js "O Teu Nome" email@exemplo.com UmaSenha123
require('dotenv').config()
const { Utilizador, sequelize } = require('../models')
const { validarSenha, hashSenha } = require('../utils/senha')

;(async () => {
  const [nome, emailBruto, senha] = process.argv.slice(2)
  if (!nome || !emailBruto || !senha) {
    console.log('Uso: node scripts/criarAdmin.js "Nome" email senha')
    process.exit(1)
  }

  const email = emailBruto.trim().toLowerCase()
  validarSenha(senha)

  if (await Utilizador.findOne({ where: { email } })) {
    console.log('Já existe um utilizador com este email.')
    process.exit(1)
  }

  const u = await Utilizador.create({
    nome: nome.trim(),
    email,
    perfil: 'admin',
    senha_hash: await hashSenha(senha),
  })
  console.log(`Administrador criado: ${u.nome} <${u.email}>`)
  await sequelize.close()
})().catch((erro) => {
  console.error('Erro:', erro.message)
  process.exit(1)
})
