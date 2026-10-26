import ModalGestao from './ModalGestao'

const campos = [
  { nome: 'nome', rotulo: 'Nome', obrigatorio: true, max: 100, cheio: true },
  { nome: 'descricao', rotulo: 'Descrição', max: 255, cheio: true },
]

// props: aberto, aoFechar, aoAlterar
export default function ModalCategoria(props) {
  return (
    <ModalGestao
      {...props}
      titulo="Categorias"
      endpoint="categorias"
      chave="categorias"
      campos={campos}
      descreverItem={(c) => c.descricao || ''}
      rotuloNovo="Nova categoria"
      rotuloEditar="Editar categoria"
      textoVazio="Ainda não há categorias."
    />
  )
}
