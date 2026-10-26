const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { ErroValidacao } = require('./validacao')

const CUSTO = 12

// Regras: 8 a 72 caracteres (o bcrypt ignora o que passa de 72 bytes), com letras e números
function validarSenha(senha, campo = 'Senha') {
  const s = typeof senha === 'string' ? senha : ''
  if (s.length < 8) throw new ErroValidacao(`${campo} deve ter pelo menos 8 caracteres.`)
  if (Buffer.byteLength(s) > 72) throw new ErroValidacao(`${campo} é demasiado longa (máximo 72 caracteres).`)
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) {
    throw new ErroValidacao(`${campo} deve ter letras e números.`)
  }
  return s
}

const hashSenha = (senha) => bcrypt.hash(senha, CUSTO)
const compararSenha = (senha, hash) => bcrypt.compare(String(senha || ''), hash)

// Senha temporária legível (sem 0/O/1/l/I) para o admin entregar ao utilizador
function senhaTemporaria() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const todos = letras + '23456789'
  let s
  do {
    s = Array.from({ length: 12 }, () => todos[crypto.randomInt(todos.length)]).join('')
  } while (!/[A-Za-z]/.test(s) || !/\d/.test(s))
  return s
}

module.exports = { validarSenha, hashSenha, compararSenha, senhaTemporaria }
