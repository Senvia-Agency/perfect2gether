import { useEffect, useMemo, useRef } from "react";

interface CampaignEmailPreviewProps {
  htmlContent?: string | null;
  subject?: string | null;
  className?: string;
}

const PREVIEW_DOCUMENT_STYLES = `
  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 24px;
    background: hsl(30 14% 96%);
    color: hsl(20 14% 12%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  table {
    max-width: 100%;
  }
`;

export function CampaignEmailPreview({ htmlContent, subject, className }: CampaignEmailPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewDocument = useMemo(() => {
    const content = htmlContent?.trim();

    if (!content) {
      return "";
    }

    if (/(<!doctype|<html|<head|<body)/i.test(content)) {
      return content;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>${PREVIEW_DOCUMENT_STYLES}</style>
        </head>
        <body>${content}</body>
      </html>
    `;
  }, [htmlContent]);

  useEffect(() => {
    if (!previewDocument || !iframeRef.current) {
      return;
    }

    const doc = iframeRef.current.contentDocument;
    if (!doc) {
      return;
    }

    doc.open();
    doc.write(previewDocument);
    doc.close();
  }, [previewDocument]);

  return (
    <div className={["flex h-full flex-col gap-4 p-4 md:p-6", className].filter(Boolean).join(" ")}>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Preview do email</p>
        {subject && <p className="text-sm text-muted-foreground truncate">Assunto: {subject}</p>}
      </div>

      {previewDocument ? (
        <div className="flex-1 min-h-[420px] overflow-hidden rounded-xl border bg-background shadow-sm">
          <iframe
            ref={iframeRef}
            title="Preview do email da campanha"
            className="h-full w-full bg-background"
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-[420px] items-center justify-center rounded-xl border bg-muted/30 p-6">
          <div className="max-w-md space-y-3 text-center">
            <p className="text-base font-semibold">Preview indisponível</p>
            <p className="text-sm text-muted-foreground">
              Esta campanha não tem o conteúdo HTML guardado, por isso o preview visual não pode ser mostrado aqui.
            </p>
            {subject && (
              <div className="rounded-lg border bg-background px-4 py-3 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assunto</p>
                <p className="mt-1 text-sm font-medium text-foreground">{subject}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
