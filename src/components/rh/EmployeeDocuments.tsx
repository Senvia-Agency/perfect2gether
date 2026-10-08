import { ConfigRecords } from "./ConfigRecords";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { RhSnapshot, RhRecord } from "@/lib/rh/schema";
import { text } from "@/lib/rh/schema";

import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { Field, Submit } from "./Fields";

export function EmployeeDocuments({
  data,
  workspace,
  documents,
  selected,
  busy,
  files,
  download,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly documents: readonly RhRecord[];
  readonly selected: string;
  readonly busy: boolean;
  readonly files: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  readonly download: (record: RhRecord) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos privados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
          >
            <span className="break-all">
              {text(r.data, "name")} · {text(r.data, "category")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void download(r)}
            >
              Abrir (ligação temporária)
            </Button>
          </div>
        ))}
        {(selected === workspace.userId ||
          data.permissions["documents.manage"]) && (
          <ConfigRecords
            records={documents}
            data={data}
            workspace={workspace}
          />
        )}
        {!documents.length && (
          <p className="text-sm text-muted-foreground">Sem documentos.</p>
        )}
        {(selected === workspace.userId ||
          data.permissions["documents.manage"]) && (
          <form
            onSubmit={(e) => void files(e)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field name="category" label="Categoria" required />
            <Field name="files" label="Carregar vários documentos">
              <Input
                id="files"
                name="files"
                type="file"
                required
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
              />
            </Field>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              PDF, imagem ou Word; máximo 20 MB por ficheiro. Os documentos são
              privados.
            </p>
            <Submit busy={busy} label="Carregar documentos" />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
