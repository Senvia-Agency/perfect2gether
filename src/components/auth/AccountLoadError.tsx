import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AccountLoadError({ retry, failed }: { retry: () => void; failed: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Não foi possível carregar a conta</h1>
        <p className="text-sm text-muted-foreground">
          {failed
            ? 'A ligação aos dados falhou. A sessão continua iniciada; tente carregar novamente.'
            : 'Não foi encontrada uma organização para esta conta. Tente carregar novamente.'}
        </p>
        <Button onClick={retry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
