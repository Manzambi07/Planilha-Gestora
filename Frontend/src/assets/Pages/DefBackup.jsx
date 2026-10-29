import { useEffect, useState } from 'react'
import { Download, Save, Trash } from 'lucide-react'
import Modal from './Modal'
import modal from './Modal.module.css'
import estilo from './Painel.module.css'
import { API, pedir } from './api'
import { token } from './sessao'
import { dataHora } from './formatar'

const tamanhoLegivel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const FRASE = 'ELIMINAR TESTES'

export default function DefBackup() {
  const [dados, setDados] = useState(null)
  const [config, setConfig] = useState(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [criando, setCriando] = useState(false)
  const [apagar, setApagar] = useState(null)
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [modalTestes, setModalTestes] = useState(false)
  const [frase, setFrase] = useState('')

  useEffect(() => {
    const controlador = new AbortController()
    Promise.all([
      pedir('/api/backup', { signal: controlador.signal }),
      pedir('/api/faturacao/config', { signal: controlador.signal }),
    ])
      .then(([b, c]) => { setDados(b); setConfig(c) })
      .catch((e) => { if (e.name !== 'AbortError') setErro(e.message) })
    return () => controlador.abort()
  }, [tentativa])

  const recarregar = () => setTentativa((n) => n + 1)

  const criar = async () => {
    setErro(''); setOk(''); setCriando(true)
    try {
      const d = await pedir('/api/backup', { method: 'POST' })
      setOk(`Cópia criada: ${d.backup.nome} (${tamanhoLegivel(d.backup.tamanho)}). Descarregue-a e guarde-a fora do computador.`)
      recarregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCriando(false)
    }
  }

  // o descarregamento precisa do token, por isso é feito por pedido e não por ligação simples
  const descarregar = async (nome) => {
    setErro(''); setOk('')
    try {
      const resposta = await fetch(`${API}/api/backup/${encodeURIComponent(nome)}/download`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!resposta.ok) {
        const d = await resposta.json().catch(() => ({}))
        throw new Error(d.erro || 'Não foi possível descarregar a cópia.')
      }
      const url = URL.createObjectURL(await resposta.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErro(e.message)
    }
  }

  const confirmarApagar = async () => {
    setATrabalhar(true)
    try {
      await pedir(`/api/backup/${encodeURIComponent(apagar)}`, { method: 'DELETE' })
      setApagar(null)
      recarregar()
    } catch (e) {
      setErro(e.message)
      setApagar(null)
    } finally {
      setATrabalhar(false)
    }
  }

  const limparTestes = async () => {
    setErro(''); setOk(''); setATrabalhar(true)
    try {
      const d = await pedir('/api/faturacao/limpar-testes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao: frase }),
      })
      setOk(d.documentos === 0
        ? 'Não havia documentos para eliminar.'
        : `${d.documentos} documento(s) eliminados. O stock foi reposto e a numeração voltou ao início.`)
      setModalTestes(false)
      setFrase('')
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  const certificado = config && config.programa && config.programa.certificado

  return (
    <div className={estilo.formulario} style={{ maxWidth: 920 }}>
      <h2 className={estilo.secaoTitulo}>Cópia de segurança</h2>
      <p className={estilo.secaoSub}>
        Guarda a base de dados e as imagens (produtos, logotipo, QR Codes) num único ficheiro .zip.
        Guarde uma cópia fora deste computador, num disco externo ou na nuvem.
      </p>

      {erro && <div className={modal.erro} role="alert">{erro}</div>}
      {ok && <div className={estilo.ok} role="status">{ok}</div>}

      {dados && !dados.pgDump.disponivel && (
        <div className={modal.erro} role="alert">
          O programa <strong>pg_dump</strong> não foi encontrado, por isso ainda não é possível criar cópias.
          Instale as ferramentas do PostgreSQL ou indique o caminho em <code>PG_DUMP_PATH</code> no ficheiro .env do Backend.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} disabled={criando || !dados || !dados.pgDump.disponivel} onClick={criar}>
          <Save size={16} />&nbsp;{criando ? 'A criar a cópia...' : 'Criar cópia agora'}
        </button>
        {dados && (
          <span style={{ fontSize: 13, color: '#4b5563' }}>
            {dados.automatico
              ? `Cópia automática todos os dias às ${String(dados.hora).padStart(2, '0')}h (guarda as últimas ${dados.manter}).`
              : 'Cópia automática desligada (BACKUP_AUTOMATICO no ficheiro .env).'}
          </span>
        )}
      </div>

      <div className={estilo.painel} style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #0d0d0e' }}>
              <th style={{ padding: '10px 14px' }}>Cópia</th>
              <th style={{ padding: '10px 14px' }}>Criada em</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tamanho</th>
              <th style={{ padding: '10px 14px' }}><span style={{ position: 'absolute', left: -9999 }}>Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {!dados && !erro && <tr><td colSpan={4} className={estilo.vazioPainel}>A carregar...</td></tr>}
            {dados && dados.backups.length === 0 && <tr><td colSpan={4} className={estilo.vazioPainel}>Ainda não há cópias de segurança.</td></tr>}
            {dados && dados.backups.map((b) => (
              <tr key={b.nome} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px 14px' }}>{b.nome}{b.automatico && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>automática</span>}</td>
                <td style={{ padding: '10px 14px' }}>{dataHora(b.criadoEm)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{tamanhoLegivel(b.tamanho)}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => descarregar(b.nome)} aria-label={`Descarregar ${b.nome}`}>
                    <Download size={15} />&nbsp;Descarregar
                  </button>{' '}
                  <button type="button" className={`${modal.btn} ${modal.btnPequeno}`} onClick={() => setApagar(b.nome)} aria-label={`Eliminar ${b.nome}`}>
                    <Trash size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details style={{ marginTop: 14, fontSize: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Como restaurar uma cópia</summary>
        <ol style={{ lineHeight: 1.6 }}>
          <li>Pare o servidor (Backend).</li>
          <li>Abra o ficheiro .zip e restaure <code>base_de_dados.sql</code> com o pgAdmin (Query Tool, abrir ficheiro) ou com o comando <code>psql -U utilizador -d faturacao -f base_de_dados.sql</code>. Isto apaga e recria as tabelas.</li>
          <li>Copie a pasta <code>uploads</code> do .zip para dentro da pasta Backend, substituindo a existente.</li>
          <li>Arranque o servidor e confirme que consegue iniciar sessão.</li>
        </ol>
        <p style={{ margin: 0, color: '#4b5563' }}>O ficheiro .env não vai na cópia (tem palavras-passe): guarde-o à parte.</p>
      </details>

      <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid #d3d7df' }} />

      <h2 className={estilo.secaoTitulo}>Documentos de teste</h2>
      {certificado ? (
        <p className={estilo.secaoSub}>
          Este software já tem número de validação da AGT, por isso os documentos emitidos não podem ser eliminados.
          Para corrigir um documento, abra-o em Faturação, Documentos, e use «Anular», que emite uma nota de crédito.
        </p>
      ) : (
        <>
          <p className={estilo.secaoSub}>
            Enquanto o software não tem número de validação da AGT, os documentos emitidos não têm valor fiscal.
            Pode apagá-los todos de uma vez para começar a faturar a sério com a numeração a zero.
            O stock volta ao que era antes das vendas. Não é possível apagar documentos um a um nem desfazer esta ação.
          </p>
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} onClick={() => { setErro(''); setFrase(''); setModalTestes(true) }}>
            <Trash size={16} />&nbsp;Eliminar todos os documentos de teste
          </button>
        </>
      )}

      <Modal aberto={Boolean(apagar)} titulo="Eliminar cópia de segurança" aoFechar={() => setApagar(null)} estreita>
        <div className={modal.corpo}>
          <p className={modal.texto}>Eliminar <strong>{apagar}</strong>? Esta cópia deixa de existir neste computador.</p>
        </div>
        <div className={modal.rodape}>
          <button type="button" className={modal.btn} onClick={() => setApagar(null)}>Cancelar</button>
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} disabled={aTrabalhar} onClick={confirmarApagar}>Eliminar</button>
        </div>
      </Modal>

      <Modal aberto={modalTestes} titulo="Eliminar documentos de teste" aoFechar={() => setModalTestes(false)} estreita>
        <div className={modal.corpo}>
          <p className={modal.texto}>
            Vão ser apagados <strong>todos</strong> os documentos, pagamentos e movimentos de venda, o stock volta ao que era e a numeração recomeça em 1.
            Faça antes uma cópia de segurança se tiver dúvidas.
          </p>
          <div className={modal.campo} style={{ marginTop: 12 }}>
            <label htmlFor="frase-testes">Para confirmar, escreva <strong>{FRASE}</strong></label>
            <input id="frase-testes" value={frase} onChange={(e) => setFrase(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div className={modal.rodape}>
          <button type="button" className={modal.btn} onClick={() => setModalTestes(false)}>Cancelar</button>
          <button type="button" className={`${modal.btn} ${modal.btnPerigo}`} disabled={aTrabalhar || frase !== FRASE} onClick={limparTestes}>
            {aTrabalhar ? 'A eliminar...' : 'Eliminar tudo'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
