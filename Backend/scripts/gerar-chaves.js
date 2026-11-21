// Gera o par de chaves RSA para assinar os documentos fiscais.
//   node scripts/gerar-chaves.js [pasta] [bits]
// Por defeito: pasta "chaves", 1024 bits (o campo Hash do SAF-T aceita no máximo 172 caracteres).
// A chave PRIVADA nunca vai para o Git nem para a base de dados. A PÚBLICA entrega-se à AGT.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const pasta = process.argv[2] || 'chaves'
const bits = Number(process.argv[3] || 1024)
const privada = path.join(pasta, 'privada.pem')
const publica = path.join(pasta, 'publica.pem')

if (fs.existsSync(privada)) {
  console.error(`Já existe ${privada}. Não vou sobrescrever uma chave que pode já ter assinado documentos.`)
  process.exit(1)
}

fs.mkdirSync(pasta, { recursive: true })
const par = crypto.generateKeyPairSync('rsa', {
  modulusLength: bits,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
fs.writeFileSync(privada, par.privateKey, { mode: 0o600 })
fs.writeFileSync(publica, par.publicKey)

console.log(`Chaves geradas (${bits} bits):`)
console.log(`  privada: ${privada}  (guardar em segredo, fazer cópia segura)`)
console.log(`  pública: ${publica}  (entregar à AGT)`)
console.log('Depois: AGT_CHAVE_PRIVADA_FICHEIRO=<caminho da privada> no ambiente do servidor.')
