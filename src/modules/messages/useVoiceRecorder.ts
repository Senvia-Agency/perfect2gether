import { useCallback, useEffect, useRef, useState } from 'react';

const minimumDuration = 800;
const maximumDuration = 5 * 60 * 1000;
const recordingTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const generation = useRef(0);
  const active = useRef(true);
  const starting = useRef(false);
  const discard = useRef(false);
  const chunks = useRef<Blob[]>([]);

  const release = useCallback(() => {
    if (interval.current !== null) clearInterval(interval.current);
    interval.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    const current = recorder.current;
    if (current?.state === 'recording') current.stop();
    release();
    if (active.current) setRecording(false);
  }, [release]);

  const cancel = useCallback(() => {
    generation.current += 1;
    starting.current = false;
    discard.current = true;
    stop();
    chunks.current = [];
    if (active.current) { setRecordedFile(null); setSeconds(0); }
  }, [stop]);

  const clear = useCallback(() => { setRecordedFile(null); setError(null); setSeconds(0); }, []);

  const start = useCallback(async () => {
    if (starting.current || recorder.current?.state === 'recording') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não suporta gravação de áudio.');
      return;
    }
    const request = ++generation.current;
    starting.current = true;
    setError(null); setRecordedFile(null); setSeconds(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current || request !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = recordingTypes.find(type => MediaRecorder.isTypeSupported(type));
      const current = mimeType ? new MediaRecorder(media, { mimeType }) : new MediaRecorder(media);
      recorder.current = current;
      chunks.current = [];
      discard.current = false;
      startedAt.current = performance.now();
      current.ondataavailable = event => { if (request === generation.current && event.data.size) chunks.current.push(event.data); };
      current.onerror = () => {
        if (request !== generation.current) return;
        discard.current = true;
        setError('Não foi possível gravar o áudio.');
        stop();
      };
      current.onstop = () => {
        current.ondataavailable = null; current.onerror = null; current.onstop = null;
        if (!active.current || request !== generation.current) return;
        release(); setRecording(false);
        const duration = performance.now() - startedAt.current;
        if (!discard.current && duration >= minimumDuration && chunks.current.length) {
          const mime = current.mimeType || chunks.current[0]?.type || 'audio/webm';
          const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
          setRecordedFile(new File(chunks.current, `audio-${Date.now()}.${extension}`, { type: mime }));
        }
        chunks.current = [];
      };
      current.start(1000);
      setRecording(true);
      interval.current = setInterval(() => {
        const elapsed = performance.now() - startedAt.current;
        setSeconds(Math.min(300, Math.floor(elapsed / 1000)));
        if (elapsed >= maximumDuration) stop();
      }, 200);
    } catch (cause: unknown) {
      if (request !== generation.current || !active.current) return;
      release();
      setRecording(false);
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'Permita o acesso ao microfone para gravar áudio.' : 'Não foi possível aceder ao microfone.');
    } finally {
      if (request === generation.current) starting.current = false;
    }
  }, [release, stop]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; cancel(); };
  }, [cancel]);

  return { recording, seconds, error, recordedFile, clear, start, stop, cancel };
}
