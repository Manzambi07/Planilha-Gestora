const { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } = require('sequelize')

// Erro "esperado": a mensagem pode ser mostrada ao utilizador
class ErroValidacao extends Error {}

// Lê um texto: tira espaços, vazio vira null
const texto = (valor, campo, { max, obrigatorio = false } = {}) => {
  const t = valor === undefined || valor === null ? '' : String(valor).trim()
  if (!t) {
    if (obrigatorio) throw new ErroValidacao(`${campo} é obrigatório.`)
    return null
  }
  if (max && t.length > max) {
    throw new ErroValidacao(`${campo} não pode ter mais de ${max} caracteres.`)
  }
  return t
}

// Lê um número (aceita "12,5" e "12.5")
const numero = (
  valor,
  campo,
  { min = 0, max = 999999999999, inteiro = false, obrigatorio = true, padrao = 0 } = {}
) => {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (obrigatorio) throw new ErroValidacao(`${campo} é obrigatório.`)
    return padrao
  }
  const n = Number(String(valor).trim().replace(',', '.'))
  if (!Number.isFinite(n)) throw new ErroValidacao(`${campo} inválido.`)
  if (inteiro && !Number.isInteger(n)) {
    throw new ErroValidacao(`${campo} deve ser um número inteiro.`)
  }
  if (n < min || n > max) {
    throw new ErroValidacao(`${campo} deve estar entre ${min} e ${max}.`)
  }
  return inteiro ? n : Math.round(n * 100) / 100
}

const email = (valor, campo = 'Email') => {
  const e = texto(valor, campo, { max: 150 })
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new ErroValidacao(`${campo} inválido.`)
  }
  return e
}

const idDaRota = (valor) => numero(valor, 'ID', { min: 1, inteiro: true })

// Converte qualquer erro numa resposta JSON segura (sem expor detalhes internos)
const tratarErro = (res, erro, mensagemPadrao = 'Erro no servidor.') => {
  if (erro instanceof ErroValidacao) {
    return res.status(400).json({ erro: erro.message })
  }

  if (erro instanceof UniqueConstraintError) {
    const chave = String((erro.errors && erro.errors[0] && erro.errors[0].path) || Object.keys(erro.fields || {})[0] || '')
    const nomes = [
      ['barras', 'código de barras'],
      ['codigo', 'código'],
      ['nif', 'NIF'],
      ['email', 'email'],
      ['nome', 'nome'],
    ]
    const achado = nomes.find(([k]) => chave.includes(k))
    return res.status(409).json({
      erro: achado ? `Já existe um registo com este ${achado[1]}.` : 'Já existe um registo com estes dados.',
    })
  }

  if (erro instanceof ValidationError) {
    const msg = erro.errors && erro.errors[0] && erro.errors[0].message
    return res.status(400).json({ erro: msg || 'Dados inválidos.' })
  }

  if (erro instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ erro: 'Este registo está a ser usado noutros dados.' })
  }

  console.error(`${mensagemPadrao}`, erro.message)
  return res.status(500).json({ erro: mensagemPadrao })
}

module.exports = { ErroValidacao, texto, numero, email, idDaRota, tratarErro }
