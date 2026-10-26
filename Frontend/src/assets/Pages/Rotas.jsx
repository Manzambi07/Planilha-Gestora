
import {Outlet} from 'react-router-dom'

import Header from "../components/header"

export default function Rotas(){
    return(
        <>

            <Header></Header>
            <main>
                <Outlet></Outlet>
            </main> 
        
        </>
    )
}