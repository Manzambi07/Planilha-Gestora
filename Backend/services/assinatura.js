// Assinatura digital dos documentos fiscais (RSA) e formatação de datas no fuso de Angola.
//
// ESTADO: PROVISÓRIO. Os campos assinados e o algoritmo seguem a prática do SAF-T (AO), mas
// têm de ser confirmados na documentação técnica da AGT antes da submissão.
// Sem chave configurada o módulo fica INATIVO: nada muda no comportamento do sistema.
//
// A chave privada NUNCA fica na base de dados nem no repositório:
//   AGT_CHAVE_PRIVADA_FICHEIRO=/caminho/seguro/privada.pem   (ou)
//   AGT_CHAVE_PRIVADA_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
//   AGT_CHAVE_VERSAO=1
// A chave pública é entregue à AGT no processo de validação.
//
// O campo Hash do SAF-T aceita no máximo 172 caracteres: é o tamanho de uma assinatura RSA de 1024 bits
// em base64. Uma chave maior produz uma assinatura que não cabe, e o módulo recusa-a.
const crypto = require('crypto')
const fs = require('fs')

const FUSO_HORAS = 1 // Angola (WAT, UTC+1)
const ALGORITMO = process.env.AGT_ASSINATURA_ALGORITMO || 'RSA-SHA1'
const MAX_CARACTERES_HASH = 172

let cache // undefined = ainda não lida | null = sem chave | { privada, publica, versao }

function carregar() {
  if (cache !== undefined) return cache
  const ficheiro = process.env.AGT_CHAVE_PRIVADA_FICHEIRO
  const pem = process.env.AGT_CHAVE_PRIVADA_PEM
  let texto = null
  if (ficheiro) texto = fs.readFileSync(ficheiro, 'utf8')
  else if (pem) texto = pem.replace(/\\n/g, '\n')
  if (!texto) {
    cache = null
    return cache
  }
  const privada = crypto.createPrivateKey(texto)
  cache = { privada, publica: crypto.createPublicKey(privada), versao: Number(process.env.AGT_CHAVE_VERSAO || 1) }
  return cache
}

const ativo = () => carregar() !== null

// Data e instante no calendário de Angola. Estes são EXATAMENTE os valores que vão para o SAF-T
// (InvoiceDate e SystemEntryDate), para a AGT conseguir refazer a assinatura a partir do ficheiro.
const noFuso = (data) => new Date(new Date(data).getTime() + FUSO_HORAS * 3600 * 1000)
const dataAngola = (data) => noFuso(data).toISOString().slice(0, 10)
const instanteAngola = (data) => noFuso(data).toISOString().slice(0, 19)

/**
 * Texto assinado: InvoiceDate;SystemEntryDate;InvoiceNo;GrossTotal;assinatura do documento anterior.
 * (a emissão é imediata, por isso InvoiceDate e SystemEntryDate vêm do mesmo instante)
 */
function textoParaAssinar({ dataEmissao, numeroCompleto, totalCentimos, assinaturaAnterior }) {
  return [
    dataAngola(dataEmissao),
    instanteAngola(dataEmissao),
    numeroCompleto,
    (totalCentimos / 100).toFixed(2),
    assinaturaAnterior || '',
  ].join(';')
}

// Devolve { assinatura, versao } ou null (módulo inativo)
function assinar(texto) {
  const chave = carregar()
  if (!chave) return null
  const assinatura = crypto.createSign(ALGORITMO).update(texto, 'utf8').sign(chave.privada, 'base64')
  if (assinatura.length > MAX_CARACTERES_HASH) {
    throw new Error(
      `A assinatura tem ${assinatura.length} caracteres e o campo Hash do SAF-T aceita ${MAX_CARACTERES_HASH}. Use uma chave RSA de 1024 bits.`,
    )
  }
  return { assinatura, versao: chave.versao }
}

function verificar(texto, assinatura) {
  const chave = carregar()
  if (!chave) return null
  return crypto.createVerify(ALGORITMO).update(texto, 'utf8').verify(chave.publica, assinatura, 'base64')
}

module.exports = { ativo, assinar, verificar, textoParaAssinar, dataAngola, instanteAngola, MAX_CARACTERES_HASH }
