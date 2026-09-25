import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Keep the authentication gate closed while giving slow connections a way to recover. */
export function AccountLoading({ totalLink = false }: { totalLink?: boolean }) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSlow(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`flex min-h-screen items-center justify-center p-6 ${totalLink ? 'total-link-shell' : 'bg-background'}`}>
      <div className="max-w-md space-y-4 text-center" role="status" aria-live="polite">
        <Loader2 className={`mx-auto h-8 w-8 animate-spin ${totalLink ? 'text-[#1659c9]' : 'text-primary'}`} aria-hidden="true" />
        {isSlow ? (
          <>
            <h1 className="text-xl font-semibold">A ligação está a demorar</h1>
            <p className="text-sm text-muted-foreground">
              Ainda estamos a tentar carregar a sua conta. Aguarde mais um pouco ou tente carregar novamente.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </>
        ) : (
          <span className="sr-only">A carregar a sua conta</span>
        )}
      </div>
    </div>
  );
}
