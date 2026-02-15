import { Clock } from 'lucide-react';
import { useSnapshot } from '../context/SnapshotContext';

export const TimeTravelPicker = () => {
    const { snapshotDate, setSnapshotDate } = useSnapshot();

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${snapshotDate ? 'bg-red-50 border-red-200 shadow-inner' : 'bg-white border-slate-200 shadow-sm'}`}>
            <Clock className={`w-4 h-4 ${snapshotDate ? 'text-red-600' : 'text-slate-400'}`} />
            <input
                type="date"
                className={`bg-transparent text-xs border-none focus:ring-0 p-0 w-24 font-medium ${snapshotDate ? 'text-red-700' : 'text-slate-600'}`}
                value={snapshotDate || ''}
                onChange={(e) => setSnapshotDate(e.target.value || null)}
                title="Машина времени: Просмотр истории"
            />
            {snapshotDate && (
                <button onClick={() => setSnapshotDate(null)} className="text-xs text-red-400 hover:text-red-600 font-bold px-1" title="Сбросить дату">✕</button>
            )}
        </div>
    );
};
