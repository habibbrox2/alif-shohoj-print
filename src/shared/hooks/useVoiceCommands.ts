import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VoiceCommandListener,
  isVoiceCommandSupported,
} from '../services/voiceCommands';
import type { VoiceCommandId, VoiceCommandLang } from '../types/voiceCommands';

export interface VoiceCommandHandlers {
  onCommand: (id: VoiceCommandId, transcript: string) => void;
}

export function useVoiceCommands(lang: VoiceCommandLang = 'bn', handlers: VoiceCommandHandlers) {
  const [supported] = useState(() => isVoiceCommandSupported());
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<VoiceCommandId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<VoiceCommandListener | null>(null);
  const handlerRef = useRef(handlers.onCommand);
  handlerRef.current = handlers.onCommand;

  const stop = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!isVoiceCommandSupported()) {
      setError('not_supported');
      return false;
    }
    listenerRef.current?.stop();
    const listener = new VoiceCommandListener({
      lang,
      onCommand: (id, transcript) => {
        setLastCommand(id);
        setLastTranscript(transcript);
        handlerRef.current(id, transcript);
        // Single-shot per tap: stop after a match so the mic does not stay hot.
        listener.stop();
        setListening(false);
      },
      onTranscript: (transcript, matched) => {
        setLastTranscript(transcript);
        if (!matched) setLastCommand(null);
      },
      onError: message => {
        setError(message);
        setListening(false);
      },
    });
    listenerRef.current = listener;
    const ok = listener.start();
    setListening(ok);
    if (ok) setError(null);
    return ok;
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => stop, [stop]);

  return { supported, listening, lastTranscript, lastCommand, error, start, stop, toggle };
}
