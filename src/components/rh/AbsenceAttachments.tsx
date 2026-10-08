import { Button } from "@/components/ui/button";
import type { RhSnapshot } from "@/lib/rh/schema";
import { text } from "@/lib/rh/schema";
import { privateUrl } from "@/lib/rh/api";
import { toast } from "sonner";
export function AbsenceAttachments({
  data,
  id,
}: {
  readonly data: RhSnapshot;
  readonly id: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {data.records
        .filter(
          (r) => r.kind === "document" && text(r.data, "absence_id") === id,
        )
        .map((r) => (
          <Button
            key={r.id}
            variant="link"
            className="h-auto whitespace-normal break-all text-left"
            onClick={() =>
              void privateUrl(text(r.data, "path"))
                .then((url) =>
                  window.open(url, "_blank", "noopener,noreferrer"),
                )
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Erro ao abrir anexo",
                  ),
                )
            }
          >
            {text(r.data, "name")}
          </Button>
        ))}
    </div>
  );
}
