const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const BACKEND = path.join(__dirname, '..')
const RAIZ_UPLOADS = path.join(BACKEND, 'uploads')
const PASTA_QR = path.join(RAIZ_UPLOADS, 'qrcodes')

// O que fica "dentro" do QR Code. A tela de vendas lê este texto e procura o produto pelo token.
const payloadQr = (token) => `PROD:${token}`

// Gera a imagem PNG do QR e devolve o caminho relativo (o que se guarda na BD)
async function gerarQr(token) {
  fs.mkdirSync(PASTA_QR, { recursive: true })
  const ficheiro = `${token}.png`
  await QRCode.toFile(path.join(PASTA_QR, ficheiro), payloadQr(token), {
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
  return `uploads/qrcodes/${ficheiro}`
}

// Apaga um ficheiro dentro de uploads/ (ignora qualquer caminho fora dessa pasta)
function apagarUpload(relativo) {
  if (!relativo) return
  const alvo = path.resolve(BACKEND, relativo)
  if (!alvo.startsWith(RAIZ_UPLOADS + path.sep)) return
  fs.promises.unlink(alvo).catch(() => {})
}

module.exports = { gerarQr, apagarUpload, payloadQr }
