import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <div className="d-none d-lg-block flex-shrink-0" style={{ width: 260 }}>
        <Sidebar />
      </div>

      <Offcanvas show={menuAberto} onHide={() => setMenuAberto(false)} className="mc-sidebar d-lg-none" style={{ width: 260 }}>
        <Sidebar aoNavegar={() => setMenuAberto(false)} />
      </Offcanvas>

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <Topbar aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="flex-grow-1 p-3 p-lg-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
