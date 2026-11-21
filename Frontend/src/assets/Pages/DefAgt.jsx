import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import modal from './Modal.module.css'
import estilo from './Painel.module.css'
import { API, pedir } from './api'
import { token } from './sessao'

const dois = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

// Linha "rótulo: valor" com um estado (configurado / por configurar)
function Estado({ rotulo, bom, texto, dica }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
      <strong style={{ minWidth: 220 }}>{rotulo}</strong>
      <span style={{ color: bom ? '#166534' : '#92400e', fontWeight: 600 }}>{texto}</span>
      {dica && <span style={{ fontSize: 13, color: '#4b5563' }}>{dica}</span>}
    </div>
  )
}

export default function DefAgt() {
  const hoje = new Date()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [periodo, setPeriodo] = useState({ desde: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) })
  const [exportando, setExportando] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)

  useEffect(() => {
    const controlador = new AbortController()
    pedir('/api/agt/estado', { signal: controlador.signal })
      .then(setDados)
      .catch((e) => { if (e.name !== 'AbortError') setErro(e.message) })
    return () => controlador.abort()
  }, [tentativa])

  const recarregar = () => setTentativa((n) => n + 1)
  const c = dados && dados.configuracao

  // o descarregamento precisa do token, por isso é feito por pedido e não por ligação simples
  const exportar = async () => {
    setErro(''); setOk(''); setExportando(true)
    try {
      const resposta = await fetch(`${API}/api/saft?desde=${periodo.desde}&ate=${periodo.ate}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!resposta.ok) {
        const d = await resposta.json().catch(() => ({}))
        throw new Error(d.erro || 'Não foi possível exportar o SAF-T.')
      }
      const disposicao = resposta.headers.get('Content-Disposition') || ''
      const nome = (disposicao.match(/filename="([^"]+)"/) || [])[1] || `SAFT-AO_${periodo.desde}_${periodo.ate}.xml`
      const url = URL.createObjectURL(await resposta.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOk(`Ficheiro ${nome} descarregado.`)
    } catch (e) {
      setErro(e.message)
    } finally {
      setExportando(false)
    }
  }

  const enviarAgora = async () => {
    setErro(''); setOk(''); setAEnviar(true)
    try {
      const d = await pedir('/api/agt/processar', { method: 'POST' })
      setOk(d.ativo ? `Envio feito: ${d.enviados} enviado(s), ${d.falhados} com falha.` : 'O envio à AGT ainda não está ligado.')
      recarregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <div className={estilo.formulario} style={{ maxWidth: 920 }}>
      <h2 className={estilo.secaoTitulo}>Exportar SAF-T (AO)</h2>
      <p className={estilo.secaoSub}>
        Ficheiro XML com os documentos do período, no formato da AGT. O período não pode passar de um ano.
      </p>

      {erro && <div className={modal.erro} role="alert">{erro}</div>}
      {ok && <div className={estilo.ok} role="status">{ok}</div>}

      <div className={modal.grade}>
        <div className={modal.campo}>
          <label htmlFor="saft-desde">Desde</label>
          <input id="saft-desde" type="date" value={periodo.desde} max={periodo.ate} onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))} />
        </div>
        <div className={modal.campo}>
          <label htmlFor="saft-ate">Até</label>
          <input id="saft-ate" type="date" value={periodo.ate} min={periodo.desde} onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))} />
        </div>
      </div>
      <div className={modal.acoesForm}>
        <button type="button" className={`${modal.btn} ${modal.btnPrimario}`} disabled={exportando || !periodo.desde || !periodo.ate} onClick={exportar}>
          <Download size={16} />&nbsp;{exportando ? 'A gerar o ficheiro...' : 'Exportar SAF-T'}
        </button>
      </div>

      <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid #d3d7df' }} />

      <h2 className={estilo.secaoTitulo}>Estado da ligação à AGT</h2>
      <p className={estilo.secaoSub}>
        Estes valores definem-se no servidor (variáveis de ambiente), nunca aqui: assim ninguém os altera ou vê pelo navegador.
        Só é mostrado se estão configurados.
      </p>

      {!c && !erro && <p className={estilo.vazioPainel}>A carregar...</p>}
      {c && (
        <>
          <Estado
            rotulo="Número de validação do software"
            bom={Boolean(c.certificado)}
            texto={c.certificado ? c.certificado : 'Por configurar'}
            dica={c.certificado ? 'As faturas passam a mostrar este número e têm valor fiscal.' : 'Variável AGT_CERTIFICADO (formato NNN/AGT/AAAA), depois de a AGT validar o software.'}
          />
          <Estado
            rotulo="Chave de assinatura"
            bom={c.assinaturaAtiva}
            texto={c.assinaturaAtiva ? `Ativa (versão ${c.chaveVersao})` : 'Por configurar'}
            dica={c.assinaturaAtiva ? '' : 'Variável AGT_CHAVE_PRIVADA_PEM. Gere com «node scripts/gerar-chaves.js».'}
          />
          <Estado
            rotulo="Empresa produtora do software"
            bom={c.produtora}
            texto={c.produtora ? 'Configurada' : 'Por configurar'}
            dica={c.produtora ? '' : 'Variáveis PRODUTORA_NOME e PRODUTORA_NIF (obrigatórias para o SAF-T).'}
          />
          <Estado
            rotulo="Envio automático à AGT"
            bom={c.apiConfigurada}
            texto={c.apiConfigurada ? 'Ligado' : 'Desligado'}
            dica={c.apiConfigurada ? '' : 'Liga-se quando a AGT fornecer a API (variáveis AGT_API_URL e AGT_API_TOKEN).'}
          />

          <h3 style={{ margin: '22px 0 8px', fontSize: 16 }}>Fila de envio</h3>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            Pendentes: <strong>{dados.pendente}</strong> · Enviados: <strong>{dados.enviado}</strong> · Com erro: <strong>{dados.erro}</strong> · Rejeitados: <strong>{dados.rejeitado}</strong>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className={modal.btn} disabled={!c.apiConfigurada || aEnviar} onClick={enviarAgora}>
              {aEnviar ? 'A enviar...' : 'Enviar pendentes agora'}
            </button>
            <button type="button" className={modal.btn} onClick={recarregar}>
              <RefreshCw size={16} />&nbsp;Atualizar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
