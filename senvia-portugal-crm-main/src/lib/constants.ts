// Versão actual do Senvia OS
export const APP_VERSION = '1.30.1';

// URL base da aplicação em produção
export const PRODUCTION_URL = 'https://app.senvia.pt';

// Detecta o ambiente e retorna a URL base correcta
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Se for ambiente de desenvolvimento/preview, usar PRODUCTION_URL
    if (hostname.includes('lovableproject.com') || hostname.includes('lovable.app') || hostname === 'localhost') {
      return PRODUCTION_URL;
    }
    // Caso contrário, usar o domínio actual (já é produção)
    return window.location.origin;
  }
  return PRODUCTION_URL;
};

// Helper para gerar URLs de produção
export const getProductionUrl = (path: string) => {
  const base = getBaseUrl();
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
};
