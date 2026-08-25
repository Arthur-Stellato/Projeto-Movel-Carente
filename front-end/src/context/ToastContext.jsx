import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ToastBootstrap from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';

const ToastContext = createContext(null);

const ICONE_POR_TIPO = {
  sucesso: 'bi-check-circle-fill',
  erro: 'bi-exclamation-octagon-fill',
  info: 'bi-info-circle-fill',
};

const VARIANTE_POR_TIPO = {
  sucesso: 'success',
  erro: 'danger',
  info: 'dark',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(0);

  const mostrar = useCallback((mensagem, tipo = 'sucesso') => {
    const id = proximoId.current++;
    setToasts((atual) => [...atual, { id, mensagem, tipo }]);
  }, []);

  const remover = useCallback((id) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <ToastContainer position="bottom-end" className="p-3 mc-toast-container" style={{ position: 'fixed' }}>
        {toasts.map((toast) => (
          <ToastBootstrap
            key={toast.id}
            bg={VARIANTE_POR_TIPO[toast.tipo]}
            onClose={() => remover(toast.id)}
            show
            delay={4500}
            autohide
          >
            <ToastBootstrap.Body className={toast.tipo === 'erro' || toast.tipo === 'sucesso' ? 'text-white d-flex align-items-center gap-2' : 'd-flex align-items-center gap-2'}>
              <i className={`bi ${ICONE_POR_TIPO[toast.tipo]}`} />
              <span>{toast.mensagem}</span>
            </ToastBootstrap.Body>
          </ToastBootstrap>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast precisa estar dentro de um ToastProvider');
  return contexto;
}
