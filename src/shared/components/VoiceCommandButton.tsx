import { useState, type FC } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { getVoiceCommandHints } from '../services/voiceCommands';
import type { VoiceCommandId, VoiceCommandLang } from '../types/voiceCommands';

interface VoiceCommandButtonProps {
  lang?: VoiceCommandLang;
  onCommand: (id: VoiceCommandId, transcript: string) => void;
  compact?: boolean;
}

export const VoiceCommandButton: FC<VoiceCommandButtonProps> = ({ lang = 'bn', onCommand, compact = false }) => {
  const [showHelp, setShowHelp] = useState(false);
  const { supported, listening, lastTranscript, lastCommand, toggle } = useVoiceCommands(lang, { onCommand });
  const hints = getVoiceCommandHints(lang);

  if (!supported) {
    return (
      <span className={compact ? 'text-[10px] text-slate-500' : 'text-[11px] text-slate-400'}>
        {lang === 'bn' ? 'এই ব্রাউজারে ভয়েস কমান্ড নেই' : 'Voice commands not supported here'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={lang === 'bn' ? 'ভয়েস কমান্ড' : 'Voice command'}
        title={lastTranscript ?? (lang === 'bn' ? 'বলুন: পরের ধাপ, কনফার্ম…' : 'Say: next, confirm…')}
        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
          listening
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
        }`}
      >
        {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
        {!compact && <span className="text-[10px] font-semibold">{listening ? (lang === 'bn' ? 'শুনছে…' : 'Listening…') : '🎤'}</span>}
      </button>
      {!compact && lastCommand && (
        <span className="text-[10px] text-emerald-300 truncate max-w-[120px]">✓ {lastTranscript}</span>
      )}
      <button
        type="button"
        onClick={() => setShowHelp(value => !value)}
        aria-expanded={showHelp}
        className="px-1.5 py-1 rounded bg-slate-800 text-[10px] text-slate-400 hover:text-white"
      >
        ?
      </button>
      {showHelp && (
        <div className="absolute z-20 mt-8 max-w-[220px] rounded-xl border border-slate-700 bg-slate-950 p-2.5 shadow-xl text-[11px] text-slate-200">
          <p className="font-bold mb-1">{lang === 'bn' ? 'বলতে পারেন:' : 'You can say:'}</p>
          <ul className="space-y-0.5">
            {hints.slice(0, 10).map(hint => (
              <li key={hint} className="text-slate-300">{hint}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
