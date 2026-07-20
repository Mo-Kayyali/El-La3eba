import { useState } from "react";
import { Modal } from "./modal";
import { Minus, Plus } from "lucide-react";

export type RoomConfig = {
  composition: string[];
  timerConfig: Record<string, number>;
};

interface RoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: RoomConfig) => void;
  friendName?: string;
}

const TIMERS = [10000, 15000, 30000, 60000];

export function RoomConfigModal({ isOpen, onClose, onConfirm, friendName }: RoomConfigModalProps) {
  const [strikesCount, setStrikesCount] = useState(2);
  const [top10Count, setTop10Count] = useState(1);
  const [strikesTimer, setStrikesTimer] = useState(10000);
  const [top10Timer, setTop10Timer] = useState(10000);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    setError("");
    if (strikesCount === 0 && top10Count === 0) {
      setError("Please select at least 1 round.");
      return;
    }
    
    if (!TIMERS.includes(strikesTimer) || !TIMERS.includes(top10Timer)) {
      setError("Invalid timer selected.");
      return;
    }

    const composition: string[] = [];
    for (let i = 0; i < strikesCount; i++) composition.push("STRIKES");
    for (let i = 0; i < top10Count; i++) composition.push("TOP_10");

    onConfirm({
      composition,
      timerConfig: {
        STRIKES: strikesTimer,
        TOP_10: top10Timer,
      }
    });
  };

  const increment = (setter: any, current: number) => setter(Math.min(5, current + 1));
  const decrement = (setter: any, current: number) => setter(Math.max(0, current - 1));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={friendName ? `Invite ${friendName}` : "Configure Private Room"} maxWidth="max-w-md">
      <div className="space-y-6">
        
        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-sky-300 uppercase tracking-wider">Strikes Mode</h3>
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">Number of Rounds (0-5)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => decrement(setStrikesCount, strikesCount)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white"><Minus size={16} /></button>
              <span className="text-white w-4 text-center font-bold">{strikesCount}</span>
              <button onClick={() => increment(setStrikesCount, strikesCount)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white"><Plus size={16} /></button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">Turn Timer</span>
            <select 
              value={strikesTimer} 
              onChange={(e) => setStrikesTimer(Number(e.target.value))}
              className="bg-[#0f172a] border border-white/10 text-white text-sm rounded-lg p-2 outline-none focus:border-sky-500 cursor-pointer"
            >
              {TIMERS.map(t => <option key={t} value={t}>{t / 1000}s</option>)}
            </select>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-sky-300 uppercase tracking-wider">Top 10 Mode</h3>
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">Number of Rounds (0-5)</span>
            <div className="flex items-center gap-3">
              <button onClick={() => decrement(setTop10Count, top10Count)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white"><Minus size={16} /></button>
              <span className="text-white w-4 text-center font-bold">{top10Count}</span>
              <button onClick={() => increment(setTop10Count, top10Count)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white"><Plus size={16} /></button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">Turn Timer</span>
            <select 
              value={top10Timer} 
              onChange={(e) => setTop10Timer(Number(e.target.value))}
              className="bg-[#0f172a] border border-white/10 text-white text-sm rounded-lg p-2 outline-none focus:border-sky-500 cursor-pointer"
            >
              {TIMERS.map(t => <option key={t} value={t}>{t / 1000}s</option>)}
            </select>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-300 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-sky-500 text-white hover:bg-sky-400 transition shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_25px_rgba(14,165,233,0.5)]"
          >
            {friendName ? "Send Invite" : "Create Lobby"}
          </button>
        </div>

      </div>
    </Modal>
  );
}
