import ModalGestao from './ModalGestao'

const campos = [
  { nome: 'nome', rotulo: 'Nome', obrigatorio: true, max: 150, cheio: true },
  { nome: 'nif', rotulo: 'NIF', max: 20 },
  { nome: 'telefone', rotulo: 'Telefone', tipo: 'tel', max: 30 },
  { nome: 'email', rotulo: 'Email', tipo: 'email', max: 150, cheio: true },
  { nome: 'endereco', rotulo: 'Endereço', max: 255, cheio: true },
]

// props: aberto, aoFechar, aoAlterar
export default function ModalFornecedor(props) {
  return (
    <ModalGestao
      {...props}
      titulo="Fornecedores"
      endpoint="fornecedores"
      chave="fornecedores"
      campos={campos}
      descreverItem={(f) => [f.nif, f.telefone, f.email].filter(Boolean).join(' · ')}
      rotuloNovo="Novo fornecedor"
      rotuloEditar="Editar fornecedor"
      textoVazio="Ainda não há fornecedores."
    />
  )
}
