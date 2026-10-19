declare namespace Deno {
 const env: { readonly get: (name: string) => string | undefined };
 function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
