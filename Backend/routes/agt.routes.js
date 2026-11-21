// Estado e arranque manual da fila de envio à AGT. Acesso: só admin (definido no server.js).
//   GET  /api/agt/estado      quantos documentos estão pendentes, enviados, com erro ou rejeitados
//   POST /api/agt/processar   tenta enviar já os pendentes (útil depois de resolver um erro)
const express = require('express')
const agt = require('../services/agt')
const assinatura = require('../services/assinatura')

const router = express.Router()

// Nunca devolve a chave privada nem o token: só diz se estão configurados
router.get('/estado', async (req, res) => {
  const certificado = (process.env.AGT_CERTIFICADO || '').trim()
  res.json({
    ...(await agt.estado()),
    configuracao: {
      certificado: certificado || null,
      assinaturaAtiva: assinatura.ativo(),
      chaveVersao: assinatura.ativo() ? Number(process.env.AGT_CHAVE_VERSAO || 1) : null,
      apiConfigurada: agt.ativo(),
      produtora: Boolean(process.env.PRODUTORA_NOME && process.env.PRODUTORA_NIF),
    },
  })
})

router.post('/processar', async (req, res) => {
  res.json(await agt.processarPendentes())
})

module.exports = router
