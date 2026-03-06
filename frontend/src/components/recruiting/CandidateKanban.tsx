import React from 'react';
import { Candidate } from '../../types/recruiting';
import { useUpdateCandidateStage } from '../../hooks/useRecruiting';
import { Grab, Clock } from 'lucide-react';
import { formatDateTime } from '../../utils';

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

const STAGE_LABELS: Record<string, string> = {
    'New': 'Новый',
    'Screening': 'Скрининг',
    'Interview': 'Интервью',
    'Offer': 'Оффер',
    'Hired': 'Принят',
    'Rejected': 'Отказ',
};

const stageColors: Record<string, string> = {
    'New': 'bg-blue-100 text-blue-800 border-blue-200',
    'Screening': 'bg-purple-100 text-purple-800 border-purple-200',
    'Interview': 'bg-amber-100 text-amber-800 border-amber-200',
    'Offer': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Hired': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Rejected': 'bg-red-100 text-red-800 border-red-200',
};

const stageHeaderColors: Record<string, string> = {
    'New': 'border-blue-300',
    'Screening': 'border-purple-300',
    'Interview': 'border-amber-300',
    'Offer': 'border-indigo-300',
    'Hired': 'border-emerald-300',
    'Rejected': 'border-red-300',
};

interface CandidateKanbanProps {
    candidates: Candidate[];
    onSelectCandidate: (id: number) => void;
    selectedCandidateId: number | null;
}

export const CandidateKanban: React.FC<CandidateKanbanProps> = ({ candidates, onSelectCandidate, selectedCandidateId }) => {
    const updateStage = useUpdateCandidateStage();

    const handleDragStart = (e: React.DragEvent, candidateId: number) => {
        e.dataTransfer.setData('candidateId', candidateId.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, stage: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData('candidateId');
        if (candidateId) {
            const cand = candidates.find(c => c.id === Number(candidateId));
            if (cand && cand.stage !== stage) {
                updateStage.mutate({ id: cand.id, stage });
            }
        }
    };

    const candidatesByStage = STAGES.reduce((acc, stage) => {
        acc[stage] = candidates.filter(c => c.stage === stage);
        return acc;
    }, {} as Record<string, Candidate[]>);

    // Any candidate with a stage not in STAGES goes to 'New'
    candidates.forEach(c => {
        if (!STAGES.includes(c.stage)) {
            candidatesByStage['New'].push(c);
        }
    });

    return (
        <div className="flex h-full w-full overflow-x-auto gap-2.5 p-2 bg-slate-50/50 rounded-xl custom-scrollbar pb-2">
            {STAGES.map((stage) => (
                <div
                    key={stage}
                    className="flex-shrink-0 w-[200px] flex flex-col h-full max-h-full"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                >
                    {/* Column header */}
                    <div className={`flex items-center justify-between mb-2 px-1 pb-1.5 border-b-2 ${stageHeaderColors[stage]}`}>
                        <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${stageColors[stage]}`}>
                            {STAGE_LABELS[stage]}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {candidatesByStage[stage]?.length || 0}
                        </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto space-y-2 pb-2 rounded-lg bg-slate-100/40 border border-slate-200/60 border-dashed p-1.5 custom-scrollbar">
                        {candidatesByStage[stage]?.map(candidate => (
                            <div
                                key={candidate.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, candidate.id)}
                                onClick={() => onSelectCandidate(candidate.id)}
                                className={`bg-white p-2.5 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${selectedCandidateId === candidate.id
                                        ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/20'
                                        : 'border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shadow-inner shrink-0">
                                        {candidate.first_name[0]}{candidate.last_name[0]}
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight truncate">
                                        {candidate.first_name} {candidate.last_name}
                                    </h4>
                                </div>

                                <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-1.5">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{formatDateTime(candidate.created_at).split(' ')[0]}</span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                                        <Grab className="w-3 h-3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
