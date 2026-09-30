import React, { useState } from 'react';
import { Package, X } from 'lucide-react';

/** Logo do app: mesmo desenho do ícone do PWA (squircle cinza + olho preto). */
export const AppLogo: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <svg
    viewBox="0 0 512 512"
    width={size}
    height={size}
    className={className}
    role="img"
    aria-label="WishWatch"
  >
    <rect width="512" height="512" rx="112.64" fill="#8A8A8A" />
    <path
      fill="#1C1C1C"
      fillRule="evenodd"
      d="M 81.92 256 A 199.17 199.17 0 0 1 430.08 256 A 199.17 199.17 0 0 1 81.92 256 Z M 322.56 256 A 66.56 66.56 0 1 0 189.44 256 A 66.56 66.56 0 1 0 322.56 256 Z"
    />
    <circle cx="256" cy="256" r="38.4" fill="#1C1C1C" />
  </svg>
);

/** Miniatura do produto com fallback quando a imagem externa não carrega. */
export const ProductThumb: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  iconSize?: string;
}> = ({ src, alt, className = '', iconSize = 'w-6 h-6' }) => {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      className={`shrink-0 bg-[#F4EFEA] rounded-lg border border-[#E8DFD1] overflow-hidden flex items-center justify-center ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain mix-blend-multiply p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className={`${iconSize} text-[#C4B7A3]`} strokeWidth={1.5} aria-hidden="true" />
      )}
    </div>
  );
};

/** Moldura padrão dos modais: folha de mobile (bottom sheet) e card centralizado no desktop. */
export const ModalShell: React.FC<{
  onClose: () => void;
  maxWidth?: string;
  labelledBy?: string;
  children: React.ReactNode;
}> = ({ onClose, maxWidth = 'max-w-lg', labelledBy, children }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#292524]/40 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`retro-card w-full ${maxWidth} overflow-hidden flex flex-col max-h-[92dvh] rounded-b-none sm:rounded-b-[14px]`}
      >
        {children}
      </div>
    </div>
  );
};

/** Cabeçalho padrão dos modais, com botão de fechar. */
export const ModalHeader: React.FC<{
  id?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ id, onClose, children }) => (
  <div className="px-4 py-3 border-b border-[#E8DFD1] flex items-center justify-between gap-3 bg-[#FAF7F2] shrink-0">
    <div id={id} className="min-w-0 flex-1">
      {children}
    </div>
    <button
      type="button"
      onClick={onClose}
      className="retro-btn retro-icon-btn text-[#78716C] hover:text-[#292524]"
      aria-label="Fechar"
      title="Fechar"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);
