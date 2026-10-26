const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')

const PASTA = path.join(__dirname, '..', 'uploads', 'empresa')
fs.mkdirSync(PASTA, { recursive: true })

const EXTENSOES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA),
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString('hex') + EXTENSOES[file.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXTENSOES[file.mimetype]) return cb(null, true)
    cb(new Error('FORMATO_INVALIDO'))
  },
})

// Recebe o campo "logotipo"
const uploadLogo = (req, res, next) => {
  upload.single('logotipo')(req, res, (erro) => {
    if (!erro) return next()
    if (erro.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ erro: 'O logotipo não pode ter mais de 2 MB.' })
    }
    if (erro.message === 'FORMATO_INVALIDO') {
      return res.status(400).json({ erro: 'O logotipo deve ser JPG, PNG ou WEBP.' })
    }
    console.error('Erro no upload do logotipo:', erro.message)
    return res.status(400).json({ erro: 'Não foi possível receber o logotipo.' })
  })
}

module.exports = uploadLogo
