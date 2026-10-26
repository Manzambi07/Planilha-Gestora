// Cálculos da faturação. Código PURO (sem base de dados), para se poder testar sozinho.
// Todo o dinheiro é tratado em CÊNTIMOS (inteiros) para nunca haver erros de vírgula flutuante.
// O ficheiro Frontend/src/assets/Pages/calculos.js tem a mesma lógica (pré-visualização no ecrã);
// o servidor é sempre quem manda.
const crypto = require('crypto')

class ErroNegocio extends Error {}

const FUSO_HORAS = 1 // Angola (WAT, UTC+1) - igual ao "timezone" do database.js

// o EPSILON corrige casos como 1,005 (que em binário é 1,00499999...) -> 101 cêntimos
const paraCentimos = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100)
const deCentimos = (centimos) => centimos / 100

/**
 * Calcula uma linha da fatura.
 *  - precosComIva = true : o preço do produto já inclui IVA (preço de prateleira)
 *  - precosComIva = false: o preço é sem IVA e o IVA soma-se por cima
 * Devolve: bruto, desconto, base (valor sem IVA), iva, totalLinha (valor com IVA, a pagar).
 */
function calcularLinha({ quantidade, precoCentimos, descontoCentimos = 0, ivaPercentagem, precosComIva }) {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new ErroNegocio('A quantidade deve ser um número inteiro maior que zero.')
  }
  if (!Number.isInteger(precoCentimos) || precoCentimos < 0) throw new ErroNegocio('Preço inválido.')
  if (!Number.isInteger(descontoCentimos) || descontoCentimos < 0) throw new ErroNegocio('Desconto inválido.')

  const bruto = quantidade * precoCentimos
  if (descontoCentimos > bruto) throw new ErroNegocio('O desconto não pode ser maior que o valor da linha.')

  const taxa = Math.round(Number(ivaPercentagem) * 100) // 14% -> 1400 (pontos-base)
  if (!Number.isFinite(taxa) || taxa < 0) throw new ErroNegocio('Taxa de IVA inválida.')

  let base
  let iva
  let totalLinha
  if (precosComIva) {
    totalLinha = bruto - descontoCentimos
    base = Math.round((totalLinha * 10000) / (10000 + taxa))
    iva = totalLinha - base
  } else {
    base = bruto - descontoCentimos
    iva = Math.round((base * taxa) / 10000)
    totalLinha = base + iva
  }
  return { bruto, desconto: descontoCentimos, base, iva, totalLinha }
}

// Soma as linhas. Garante sempre: total = subtotal + iva
function somarDocumento(linhas) {
  const soma = (campo) => linhas.reduce((s, l) => s + l[campo], 0)
  const subtotal = soma('base')
  const iva = soma('iva')
  const total = soma('totalLinha')
  if (total !== subtotal + iva) throw new Error('Incoerência nos totais do documento.')
  return { subtotal, descontoTotal: soma('desconto'), iva, total }
}

/**
 * Confere os pagamentos de um documento e calcula o troco.
 *  - tem de cobrir o total (ou o saldo em dívida);
 *  - o que passar do total é troco e sai do ÚLTIMO pagamento (que tem de ser maior que o troco).
 * pagamentos: [{ metodoId, valorCentimos, referencia }]
 */
function distribuirPagamentos(totalCentimos, pagamentos) {
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
    throw new ErroNegocio('Indique pelo menos um pagamento.')
  }
  if (pagamentos.some((p) => !Number.isInteger(p.valorCentimos) || p.valorCentimos <= 0)) {
    throw new ErroNegocio('Os valores dos pagamentos devem ser maiores que zero.')
  }
  const pago = pagamentos.reduce((s, p) => s + p.valorCentimos, 0)
  if (pago < totalCentimos) {
    throw new ErroNegocio('O valor recebido é menor que o total a pagar.')
  }
  const troco = pago - totalCentimos
  const ajustados = pagamentos.map((p) => ({ ...p }))
  if (troco > 0) {
    const ultimo = ajustados[ajustados.length - 1]
    if (ultimo.valorCentimos <= troco) {
      throw new ErroNegocio('Há pagamentos a mais: retire um dos valores.')
    }
    ultimo.valorCentimos -= troco
  }
  return { pagamentos: ajustados, troco }
}

const formatarNumero = (tipo, ano, numero) => `${tipo} ${ano}/${numero}`

// Ano civil no fuso de Angola (31/12 às 23h30 UTC já é 1/1 em Luanda)
const anoNoFuso = (data) => new Date(data.getTime() + FUSO_HORAS * 3600 * 1000).getUTCFullYear()

const instante = (data) => new Date(data).toISOString().slice(0, 19)

/**
 * Hash (SHA-256, 64 caracteres hexadecimais) que liga cada documento ao anterior da mesma série.
 * Se alguém alterar um documento já emitido, o hash dele e de todos os seguintes deixa de bater.
 * ATENÇÃO: este é o formato interno do sistema. O formato exigido pela AGT para a validação
 * (Decreto Executivo 683/25) tem de ser confirmado e ajustado aqui antes da submissão.
 */
function calcularHash({ dataEmissao, numeroCompleto, totalCentimos, hashAnterior }) {
  const texto = [
    instante(dataEmissao),
    numeroCompleto,
    (totalCentimos / 100).toFixed(2),
    hashAnterior || '',
  ].join(';')
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex')
}

module.exports = {
  ErroNegocio,
  paraCentimos,
  deCentimos,
  calcularLinha,
  somarDocumento,
  distribuirPagamentos,
  formatarNumero,
  anoNoFuso,
  calcularHash,
}
