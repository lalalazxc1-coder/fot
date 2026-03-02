import React from 'react';
import { Candidate } from '../../types/recruiting';
import { useUpdateCandidateStage } from '../../hooks/useRecruiting';
import { Grab, Clock } from 'lucide-react';
import { formatDateTime } from '../../utils';

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

const stageColors: Record<string, string> = {
    'New': 'bg-blue-100 text-blue-800 border-blue-200',
    'Screening': 'bg-purple-100 text-purple-800 border-purple-200',
    'Interview': 'bg-amber-100 text-amber-800 border-amber-200',
    'Offer': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Hired': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Rejected': 'bg-red-100 text-red-800 border-red-200',
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

    // Any candidate with a stage not in STAGES goes to 'New' visually
    candidates.forEach(c => {
        if (!STAGES.includes(c.stage)) {
            candidatesByStage['New'].push(c);
        }
    });

    return (
        <div className="flex h-full w-full overflow-x-auto gap-4 p-2 bg-slate-50/50 rounded-xl">
            {STAGES.map((stage) => (
                <div
                    key={stage}
                    className="flex-shrink-0 w-72 flex flex-col h-full max-h-full"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                >
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${stageColors[stage] || stageColors['New']}`}>
                                {stage}
                            </span>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                                {candidatesByStage[stage]?.length || 0}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pb-4 px-1 rounded-xl glass-pane bg-slate-100/50 border border-slate-200/60 p-2 border-dashed">
                        {candidatesByStage[stage]?.map(candidate => (
                            <div
                                key={candidate.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, candidate.id)}
                                onClick={() => onSelectCandidate(candidate.id)}
                                className={`bg-white p-3.5 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${selectedCandidateId === candidate.id ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/10' : 'border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                                            {candidate.first_name[0]}{candidate.last_name[0]}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                                                {candidate.first_name} {candidate.last_name}
                                            </h4>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatDateTime(candidate.created_at).split(' ')[0]}</span>
                                    </div>
                                    <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                                        <Grab className="w-4 h-4" />
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
