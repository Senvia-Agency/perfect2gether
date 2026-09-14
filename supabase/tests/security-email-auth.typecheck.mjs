import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/');
const declarationPath = `${root}supabase/tests/security-email-auth-runtime.d.ts`;
const declarations = `declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}`;
const options = {
  strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, types: [],
};
const host = ts.createCompilerHost(options);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => path === declarationPath
  ? ts.createSourceFile(path, declarations, languageVersion)
  : originalGetSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
host.resolveModuleNames = (names, containingFile) => names.map(name => {
  const localName = name.includes('@supabase/supabase-js') ? '@supabase/supabase-js' : name.includes('esm.sh/zod') ? 'zod' : name;
  return ts.resolveModuleName(localName, containingFile, options, host).resolvedModule;
});
const program = ts.createProgram([
  `${root}supabase/functions/_shared/organization-request-auth.ts`,
  `${root}supabase/functions/send-proposal-email/index.ts`,
  `${root}supabase/functions/keyinvoice-auth/index.ts`,
  `${root}supabase/functions/_shared/invoice-scope.ts`,
  `${root}supabase/functions/cancel-invoice/index.ts`,
  `${root}supabase/functions/create-credit-note/index.ts`,
  `${root}supabase/functions/check-prospect-job/index.ts`,
  declarationPath,
], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: name => name,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
}));
console.log('Strict offline TypeScript check passed for all five changed handlers and both shared helpers.');
