const { Auditoria } = require('../models')

// Regista quem fez o quê. Nunca deixa uma falha do registo rebentar o pedido principal.
async function registar(req, acao, tabela, registoId = null, detalhes = null) {
  try {
    await Auditoria.create({
      utilizador_id: req.utilizador ? req.utilizador.id : null,
      acao,
      tabela,
      registo_id: registoId,
      detalhes,
      ip: req.ip ? String(req.ip).slice(0, 45) : null,
    })
  } catch (erro) {
    console.error('Falha ao registar auditoria:', erro.message)
  }
}

module.exports = { registar }
