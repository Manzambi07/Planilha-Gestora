import Login from "./assets/Pages/Login"
import Pagina from "./assets/Pages/Pagina"
import Rotas from "./assets/Pages/Rotas"
import User from "./assets/Pages/use"
import Def from "./assets/Pages/def"
import Analise from "./assets/Pages/analise"
import Faturacao from "./assets/Pages/Faturacao"
import Protegida from "./assets/Pages/Protegida"
import { Routes, Route, BrowserRouter } from 'react-router-dom'

function App() {

  return (
    <>

      <BrowserRouter>
        <Routes>

          {/* tudo o que está aqui dentro exige sessão; a Protegida também confere o perfil */}
          <Route element={<Protegida />}>
            <Route element={<Rotas />}>

              <Route path='/Geral' element={<Pagina></Pagina>}></Route>
              <Route path='/Faturacao' element={<Faturacao></Faturacao>}></Route>
              <Route path='/User' element={<User></User>}></Route>
              <Route path='/Def' element={<Def></Def>}></Route>
              <Route path='/Analise' element={<Analise></Analise>}></Route>

            </Route>
          </Route>

          <Route path='/' element={<Login></Login>}></Route>

        </Routes>

      </BrowserRouter>
    </>
  )
}

export default App
