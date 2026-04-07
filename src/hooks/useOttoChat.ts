import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useOttoStore } from "@/stores/useOttoStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type { OttoMessage } from "@/stores/useOttoStore";

const OTTO_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/otto-chat`;

export function useOttoChat() {
  const { messages, isLoading, pendingAttachments, addMessage, updateLastMessage, clearMessages, setLoading, clearAttachments } = useOttoStore();
  const { session, organization } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const uploadAttachments = useCallback(async (files: File[]): Promise<string[]> => {
    if (!files.length || !organization?.id) return [];
    const paths: string[] = [];
    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organization.id}/${timestamp}_${safeName}`;
      const { error } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { upsert: false });
      if (error) {
        console.error("Upload error:", error);
        toast.error(`Erro ao enviar ficheiro: ${file.name}`);
      } else {
        paths.push(path);
      }
    }
    return paths;
  }, [organization]);

  const sendMessage = useCallback(async (input: string, attachments?: File[]) => {
    const userMsg = { role: "user" as const, content: input };
    addMessage(userMsg);
    setLoading(true);

    const allMessages = [...messages, userMsg];
    let assistantSoFar = "";

    // Upload attachments if provided
    let attachmentPaths: string[] = [];
    const filesToUpload = attachments || pendingAttachments;
    if (filesToUpload.length > 0) {
      attachmentPaths = await uploadAttachments(filesToUpload);
      clearAttachments();
    }

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      updateLastMessage(assistantSoFar);
    };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(OTTO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          organization_id: organization?.id || null,
          attachment_paths: attachmentPaths.length > 0 ? attachmentPaths : undefined,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao contactar o Otto");
        setLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            done = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Otto error:", e);
        toast.error("Erro ao comunicar com o Otto");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [messages, addMessage, updateLastMessage, setLoading, session, organization, pendingAttachments, uploadAttachments, clearAttachments]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isLoading, sendMessage, clearMessages, cancelStream };
}
