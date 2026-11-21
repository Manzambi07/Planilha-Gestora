// Exportação do SAF-T (AO): GET /api/saft?desde=AAAA-MM-DD&ate=AAAA-MM-DD
// Sem parâmetros exporta o mês corrente. Acesso: admin e gestor (definido no server.js).
const express = require('express')
const { exportarSaft, ErroSaft } = require('../services/saft')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const r = await exportarSaft({ desde: req.query.desde, ate: req.query.ate })
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${r.nomeFicheiro}"`,
    })
    res.send(r.xml)
  } catch (erro) {
    if (erro instanceof ErroSaft) return res.status(400).json({ erro: erro.message })
    throw erro // o Express 5 envia para o tratador de erros do server.js
  }
})

module.exports = router
