// Versão actual do Perfect2Gether
export const APP_VERSION = '26.1.24';

// Contas de suporte excluídas de métricas, comissões e listagens
export const SUPPORT_EMAILS = ['socialgaldinothi@gmail.com'];

// URL base da aplicação em produção
export const PRODUCTION_URL = 'https://app.perfect2gether.pt';

// Detecta o ambiente e retorna a URL base correcta
export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Se for localhost, usar PRODUCTION_URL para testes de integração se necessário, 
    // ou simplesmente retornar a origem atual.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
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
