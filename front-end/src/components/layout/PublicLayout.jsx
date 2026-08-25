import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

export default function PublicLayout() {
  return (
    <div className="d-flex flex-column" style={{ minHeight: '100vh' }}>
      <PublicNavbar />
      <main className="flex-grow-1">
        <Outlet />
      </main>
      <footer className="text-center text-secondary small py-4">
        MóvelCarente — plataforma de doação de itens para casa.
      </footer>
    </div>
  );
}
