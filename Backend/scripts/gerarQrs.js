// Gera a imagem do QR para os produtos que ainda não têm (ex.: os 5 de teste do SQL)
// Executar dentro da pasta Backend:  node scripts/gerarQrs.js
require('dotenv').config()
const { Produto, sequelize } = require('../models')
const { gerarQr } = require('../utils/ficheiros')

;(async () => {
  const lista = await Produto.findAll({ where: { qr_imagem: null } })
  for (const p of lista) {
    await p.update({ qr_imagem: await gerarQr(p.qr_token) })
    console.log('QR criado:', p.nome)
  }
  console.log(`Concluído: ${lista.length} QR Code(s) gerado(s).`)
  await sequelize.close()
})().catch((erro) => {
  console.error('Erro:', erro.message)
  process.exit(1)
})
