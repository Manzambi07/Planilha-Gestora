import { useEffect, useState } from 'react'
import style from './Login.module.css'
import estilo from './Painel.module.css'
import Modal from './Modal'
import modal from './Modal.module.css'
import { pedir } from './api'
import { dataHora } from './formatar'

const LIMITE = 30

const ACOES = {
  criar: 'Criou',
  editar: 'Editou',
  desativar: 'Desativou',
  reativar: 'Reativou',
  desbloquear: 'Desbloqueou',
  redefinir_senha: 'Redefiniu a senha',
  alterar_senha: 'Alterou a senha',
  login: 'Iniciou sessão',
  emitir: 'Emitiu documento',
  anular: 'Anulou documento',
  receber_pagamento: 'Recebeu pagamento',
  backup: 'Criou cópia de segurança',
  descarregar_backup: 'Descarregou cópia de segurança',
  apagar_backup: 'Eliminou cópia de segurança',
  limpar_atividade: 'Limpou registos antigos',
  limpar_testes: 'Eliminou documentos de teste',
}

const TABELAS = {
  utilizadores: 'Utilizadores',
  empresa: 'Empresa',
  taxas_iva: 'Taxas de IVA',
  metodos_pagamento: 'Métodos de pagamento',
  faturas: 'Faturas',
  clientes: 'Clientes',
  sistema: 'Sistema',
}

// Resume o JSON guardado na auditoria numa linha legível
function resumir(detalhes) {
  let d = detalhes
  if (typeof d === 'string') {
    try { d = JSON.parse(d) } catch { return d }
  }
  if (!d || typeof d !== 'object') return ''

  if (d.antes && d.depois) {
    const mudou = Object.keys(d.depois).filter((k) => String(d.antes[k] ?? '') !== String(d.depois[k] ?? ''))
    return mudou.length
      ? mudou.map((k) => `${k}: ${d.antes[k] ?? '—'} → ${d.depois[k] ?? '—'}`).join(', ')
      : 'Sem alterações'
  }
  return Object.entries(d).slice(0, 4).map(([k, v]) => `${k}: ${v ?? '—'}`).join(', ')
}

export default function DefAtividade() {
  const [acao, setAcao] = useState('')
  const [tabela, setTabela] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)
  const [dados, setDados] = useState({ total: 0, registos: [] })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [limpar, setLimpar] = useState(false)
  const [diasLimpeza, setDiasLimpeza] = useState(90)
  const [aLimpar, setALimpar] = useState(false)
  const [resultado, setResultado] = useState('')

  const executarLimpeza = async () => {
    setALimpar(true)
    setErro('')
    try {
      const d = await pedir(`/api/definicoes/atividade?dias=${diasLimpeza}`, { method: 'DELETE' })
      setResultado(d.apagados === 1 ? '1 registo eliminado.' : `${d.apagados} registos eliminados.`)
      setLimpar(false)
      setPagina(1)
      setTentativa((t) => t + 1)
    } catch (e) {
      setErro(e.message)
      setLimpar(false)
    } finally {
      setALimpar(false)
    }
  }

  useEffect(() => {
    const controlador = new AbortController()
    setCarregando(true)
    setErro('')

    const params = new URLSearchParams({ pagina, limite: LIMITE })
    if (acao) params.set('acao', acao)
    if (tabela) params.set('tabela', tabela)

    pedir(`/api/definicoes/atividade?${params}`, { signal: controlador.signal })
      .then((d) => { setDados(d); setCarregando(false) })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setErro(e.message)
        setCarregando(false)
      })
    return () => controlador.abort()
  }, [acao, tabela, pagina, tentativa])

  const totalPaginas = Math.max(1, Math.ceil(dados.total / LIMITE))

  return (
    <div>
      <div className={estilo.secao}>
        <h2 className={estilo.secaoTitulo}>Registo de atividade</h2>
        <p className={estilo.secaoSub}>Quem fez o quê no sistema, do mais recente para o mais antigo.</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className={estilo.filtro} aria-label="Filtrar por ação" value={acao}
            onChange={(e) => { setAcao(e.target.value); setPagina(1) }}>
            <option value="">Todas as ações</option>
            {Object.entries(ACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select className={estilo.filtro} aria-label="Filtrar por área" value={tabela}
            onChange={(e) => { setTabela(e.target.value); setPagina(1) }}>
            <option value="">Todas as áreas</option>
            {Object.entries(TABELAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => { setResultado(''); setLimpar(true) }}>
            Limpar registos antigos
          </button>
        </div>
        {resultado && <div className={estilo.ok} role="status" style={{ marginTop: 12 }}>{resultado}</div>}
      </div>

      <div className={style.tabelaWrap} style={{ maxHeight: 'none' }}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Área</th>
              <th>Detalhe</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {carregando && dados.registos.length === 0 && (
              <tr><td colSpan={6} className={style.vazio}>A carregar...</td></tr>
            )}

            {!carregando && erro && (
              <tr>
                <td colSpan={6} className={style.vazio}>
                  {erro}{' '}
                  <button type="button" className={style.linkBtn} onClick={() => setTentativa((t) => t + 1)}>Tentar novamente</button>
                </td>
              </tr>
            )}

            {!carregando && !erro && dados.registos.length === 0 && (
              <tr><td colSpan={6} className={style.vazio}>Nenhuma atividade registada.</td></tr>
            )}

            {!erro && dados.registos.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{dataHora(r.quando)}</td>
                <td>{r.utilizador}</td>
                <td>{ACOES[r.acao] || r.acao}</td>
                <td>{TABELAS[r.tabela] || r.tabela}{r.registoId ? ` #${r.registoId}` : ''}</td>
                <td><span className={estilo.detalhe}>{resumir(r.detalhes)}</span></td>
                <td>{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.total > LIMITE && (
        <div className={estilo.rodapeLista}>
          <span>Página {pagina} de {totalPaginas} ({dados.total} registos)</span>
          <div className={estilo.paginas}>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}>Seguinte</button>
          </div>
        </div>
      )}

      <Modal aberto={limpar} titulo="Limpar registos antigos" aoFechar={() => setLimpar(false)} estreita>
        <div className={modal.corpo}>
          <p className={modal.texto}>
            Apaga os registos de atividade mais antigos que o período escolhido. Os registos dos documentos de faturação
            nunca são apagados, e esta limpeza fica registada.
          </p>
          <div className={modal.campo} style={{ marginTop: 12 }}>
            <label htmlFor="dias-limpeza">Apagar registos com mais de</label>
            <select id="dias-limpeza" value={diasLimpeza} onChange={(e) => setDiasLimpeza(Number(e.target.value))}>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>6 meses</option>
              <option value={365}>1 ano</option>
            </select>
          </div>
        </div>
        <div className={modal.rodape}>
          <button type="button" className={modal.btn} onClick={() => setLimpar(false)}>Cancelar</button>
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} disabled={aLimpar} onClick={executarLimpeza}>
            {aLimpar ? 'A limpar...' : 'Limpar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
