// Montada em /api/backup. Só administradores (o server.js já exige).
const fs = require('fs')
const express = require('express')
const backup = require('../services/backup')
const { registar } = require('../utils/auditoria')

const router = express.Router()

// GET /api/backup  -> lista de cópias + estado do pg_dump e da cópia automática
router.get('/', async (req, res) => {
  try {
    res.json({
      backups: backup.listarBackups(),
      pgDump: await backup.verificarPgDump(),
      automatico: backup.automaticoLigado(),
      hora: backup.horaAutomatica(),
      manter: backup.manter(),
    })
  } catch (erro) {
    console.error('Erro ao listar cópias:', erro.message)
    res.status(500).json({ erro: 'Erro ao listar as cópias de segurança.' })
  }
})

// POST /api/backup  -> cria uma cópia agora
router.post('/', async (req, res) => {
  try {
    const criado = await backup.criarBackup()
    await registar(req, 'backup', 'sistema', null, { nome: criado.nome, tamanho: criado.tamanho })
    res.status(201).json({ backup: criado })
  } catch (erro) {
    console.error('Erro na cópia de segurança:', erro.message)
    res.status(500).json({ erro: erro.message })
  }
})

// GET /api/backup/:nome/download
router.get('/:nome/download', async (req, res) => {
  const caminho = backup.caminhoBackup(req.params.nome)
  if (!caminho || !fs.existsSync(caminho)) return res.status(404).json({ erro: 'Cópia não encontrada.' })
  await registar(req, 'descarregar_backup', 'sistema', null, { nome: req.params.nome })
  return res.download(caminho, req.params.nome)
})

// DELETE /api/backup/:nome
router.delete('/:nome', async (req, res) => {
  if (!backup.apagarBackup(req.params.nome)) return res.status(404).json({ erro: 'Cópia não encontrada.' })
  await registar(req, 'apagar_backup', 'sistema', null, { nome: req.params.nome })
  return res.json({ ok: true })
})

module.exports = router
