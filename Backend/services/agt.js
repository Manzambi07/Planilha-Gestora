// Fila de envio de documentos à AGT.
//
// Cada documento emitido cria uma linha em envios_agt (estado "pendente") NA MESMA TRANSAÇÃO da emissão.
// Um processo em segundo plano envia os pendentes por ordem, e repete os que falharam.
// Se a AGT estiver em baixo, a emissão continua e os documentos ficam na fila: nada se perde.
//
// ESTADO: ESQUELETO. O módulo só trabalha quando AGT_API_URL está definida. O endereço, a autenticação
// e o formato do pedido e da resposta (marcados TODO) dependem da especificação técnica da AGT.
const { QueryTypes } = require('sequelize')
const sequelize = require('../database')

const MAX_TENTATIVAS = Number(process.env.AGT_MAX_TENTATIVAS || 8)
const INTERVALO_SEGUNDOS = Number(process.env.AGT_INTERVALO_SEG || 30)

const ativo = () => Boolean(process.env.AGT_API_URL)

// Chamada dentro da transação de emissão: se a emissão falhar, a linha também desaparece
async function enfileirar(faturaId, t) {
  await sequelize.query('INSERT INTO envios_agt (fatura_id) VALUES (:id)', {
    replacements: { id: faturaId },
    transaction: t,
  })
}

// TODO(especificação AGT): trocar pelo formato exigido pela API
async function montarPayload(faturaId) {
  const { obterDocumento } = require('./faturacao') // lazy: evita dependência circular ao arrancar
  const d = await obterDocumento(faturaId, '')
  return {
    numero: d.numero,
    tipo: d.tipo,
    dataEmissao: d.dataEmissao,
    emitente: d.empresa && { nome: d.empresa.nome, nif: d.empresa.nif },
    cliente: d.cliente && { nome: d.cliente.nome, nif: d.cliente.nif },
    linhas: d.itens,
    totais: { subtotal: d.subtotal, iva: d.ivaTotal, total: d.total },
    hash: d.hash,
    assinatura: d.assinatura,
    software: d.programa,
  }
}

// TODO(especificação AGT): autenticação, método, endereço de cada operação e leitura da resposta
async function chamarApi(payload) {
  const token = process.env.AGT_API_TOKEN
  const resposta = await fetch(process.env.AGT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  })
  const corpo = await resposta.json().catch(() => ({}))
  return { ok: resposta.ok, status: resposta.status, corpo }
}

const q = (sql, replacements, type) => sequelize.query(sql, { replacements, type })

/**
 * Envia até `limite` documentos pendentes, por ordem. Pára no primeiro erro de rede para manter a ordem.
 * Respostas 4xx da AGT marcam o documento como "rejeitado" (precisa de intervenção humana).
 */
async function processarPendentes(limite = 20) {
  if (!ativo()) return { ativo: false, enviados: 0, falhados: 0 }

  const fila = await q(
    `SELECT id, fatura_id, tentativas FROM envios_agt
      WHERE estado IN ('pendente', 'erro') AND tentativas < :max
      ORDER BY fatura_id ASC LIMIT :limite`,
    { max: MAX_TENTATIVAS, limite },
    QueryTypes.SELECT,
  )

  let enviados = 0
  let falhados = 0
  for (const item of fila) {
    // "reserva" a linha: se dois processos correrem ao mesmo tempo, só um a apanha
    const [, reservado] = await sequelize.query(
      `UPDATE envios_agt SET tentativas = tentativas + 1, atualizado_em = now()
        WHERE id = :id AND tentativas = :tentativas AND estado IN ('pendente', 'erro')`,
      { replacements: { id: item.id, tentativas: item.tentativas } },
    )
    if (!reservado || reservado.rowCount === 0) continue

    try {
      const r = await chamarApi(await montarPayload(item.fatura_id))
      const estado = r.ok ? 'enviado' : r.status >= 400 && r.status < 500 ? 'rejeitado' : 'erro'
      await q(
        `UPDATE envios_agt SET estado = :estado, codigo_validacao = :codigo, resposta = :resposta::jsonb, atualizado_em = now()
          WHERE id = :id`,
        {
          estado,
          codigo: r.ok ? (r.corpo.codigoValidacao || r.corpo.codigo || null) : null, // TODO(especificação AGT)
          resposta: JSON.stringify({ http: r.status, corpo: r.corpo }),
          id: item.id,
        },
      )
      if (r.ok) enviados += 1
      else { falhados += 1; if (estado === 'erro') break }
    } catch (erro) {
      falhados += 1
      await q(
        `UPDATE envios_agt SET estado = 'erro', resposta = :resposta::jsonb, atualizado_em = now() WHERE id = :id`,
        { resposta: JSON.stringify({ erro: erro.message }), id: item.id },
      )
      break
    }
  }
  return { ativo: true, enviados, falhados }
}

async function estado() {
  const linhas = await q('SELECT estado, COUNT(*)::int AS total FROM envios_agt GROUP BY estado', {}, QueryTypes.SELECT)
  const porEstado = Object.fromEntries(linhas.map((l) => [l.estado, l.total]))
  return { ativo: ativo(), pendente: 0, enviado: 0, erro: 0, rejeitado: 0, ...porEstado }
}

let temporizador = null
function agendarEnvio() {
  if (!ativo() || temporizador) return false
  temporizador = setInterval(() => {
    processarPendentes().catch((e) => console.error('Envio AGT:', e.message))
  }, INTERVALO_SEGUNDOS * 1000)
  temporizador.unref()
  return true
}

module.exports = { enfileirar, processarPendentes, estado, agendarEnvio, ativo }
