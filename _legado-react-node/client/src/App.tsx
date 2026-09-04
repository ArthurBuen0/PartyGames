import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CriarSala from './pages/CriarSala';
import EntrarSala from './pages/EntrarSala';
import Inicio from './pages/Inicio';
import Sala from './pages/Sala';
import { SalaProvider, useSala } from './store/SalaContext';

function Conteudo() {
  const { aviso } = useSala();

  return (
    <>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/criar" element={<CriarSala />} />
        <Route path="/entrar" element={<EntrarSala />} />
        <Route path="/sala/:codigo" element={<Sala />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {aviso && (
        <p className="aviso-flutuante" role="status">
          {aviso}
        </p>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SalaProvider>
        <Conteudo />
      </SalaProvider>
    </BrowserRouter>
  );
}
