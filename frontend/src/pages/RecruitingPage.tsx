import React, { useState } from 'react';
import { Plus, LayoutDashboard } from 'lucide-react';
import { VacancyList } from '../components/recruiting/VacancyList';
import { CandidateKanban } from '../components/recruiting/CandidateKanban';
import { CommentsSection } from '../components/recruiting/CommentsSection';
import { useVacancies, useCandidates, useVacancy, useUpdateVacancyStatus, useCreateCandidate } from '../hooks/useRecruiting';
import Modal from '../components/Modal';
import { Button, Input, Select } from '../components/ui-mocks';

export default function RecruitingPage() {
    const { data: vacancies = [], isLoading: isLoadingVacancies } = useVacancies();
    const [selectedVacancyId, setSelectedVacancyId] = useState<number | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

    const { data: candidates = [] } = useCandidates(selectedVacancyId || undefined);
    const { data: selectedVacancy } = useVacancy(selectedVacancyId);

    // Modals state
    const [isCandidateModalOpen, setCandidateModalOpen] = useState(false);

    // Form states
    const [newCandidate, setNewCandidate] = useState({ first_name: '', last_name: '', stage: 'New' });

    const updateVacancyStatus = useUpdateVacancyStatus();
    const createCandidate = useCreateCandidate();

    const handleCreateCandidate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVacancyId) return;

        createCandidate.mutate({
            vacancy_id: selectedVacancyId,
            first_name: newCandidate.first_name,
            last_name: newCandidate.last_name,
            stage: newCandidate.stage
        }, {
            onSuccess: () => {
                setCandidateModalOpen(false);
                setNewCandidate({ first_name: '', last_name: '', stage: 'New' });
            }
        });
    };

    const handleStatusChange = (status: string) => {
        if (!selectedVacancyId) return;
        updateVacancyStatus.mutate({ id: selectedVacancyId, status });
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 p-2">
            {/* Left Sidebar: Vacancies */}
            <div className="w-full md:w-1/3 xl:w-1/4 h-full flex flex-col min-h-0">
                {isLoadingVacancies ? (
                    <div className="flex-1 flex justify-center items-center bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <VacancyList
                        vacancies={vacancies}
                        selectedId={selectedVacancyId}
                        onSelect={(id) => {
                            setSelectedVacancyId(id);
                            setSelectedCandidateId(null);
                        }}
                    />
                )}
            </div>

            {/* Right Main Area: Kanban and Details */}
            <div className="flex-1 h-full min-h-0 flex flex-col gap-6">
                {!selectedVacancyId ? (
                    <div className="flex-1 flex flex-col justify-center items-center bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200 border-dashed shadow-sm text-center p-8">
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                            <LayoutDashboard className="w-10 h-10" />
                        </div>
                        <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">
                            Выберите заявку из списка слева для просмотра воронки кандидатов, статистики и комментариев от руководителя.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="h-3/5 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex-1 items-center flex justify-between">
                                    <div className="flex flex-col">
                                        <h2 className="text-lg font-bold text-slate-800">{selectedVacancy?.title}</h2>
                                        <p className="text-xs text-slate-500 font-medium">Кандидаты: {candidates.length}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <select
                                            title="Статус вакансии"
                                            className="text-xs rounded-lg border-slate-200 bg-white font-semibold py-1.5 px-3 focus:ring-blue-500 block h-9"
                                            value={selectedVacancy?.status || 'Draft'}
                                            onChange={(e) => handleStatusChange(e.target.value)}
                                        >
                                            <option value="Draft">Draft (Черновик)</option>
                                            <option value="Open">Open (Открыта)</option>
                                            <option value="In Progress">In Progress (В работе)</option>
                                            <option value="Closed">Closed (Закрыта)</option>
                                            <option value="Cancelled">Cancelled (Отменена)</option>
                                        </select>
                                        <Button
                                            onClick={() => setCandidateModalOpen(true)}
                                            className="h-9 px-3 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Добавить кандидата
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 p-2 overflow-hidden bg-slate-50/20">
                                <CandidateKanban
                                    candidates={candidates}
                                    selectedCandidateId={selectedCandidateId}
                                    onSelectCandidate={(id: number) => setSelectedCandidateId(id)}
                                />
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div className="h-2/5 min-h-0">
                            <CommentsSection
                                targetType={selectedCandidateId ? 'candidate' : 'vacancy'}
                                targetId={selectedCandidateId || selectedVacancyId}
                            />
                        </div>
                    </>
                )}
            </div>

            <Modal isOpen={isCandidateModalOpen} onClose={() => setCandidateModalOpen(false)} title="Новый кандидат">
                <form onSubmit={handleCreateCandidate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Имя</label>
                            <Input required value={newCandidate.first_name} onChange={e => setNewCandidate({ ...newCandidate, first_name: e.target.value })} placeholder="Иван" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Фамилия</label>
                            <Input required value={newCandidate.last_name} onChange={e => setNewCandidate({ ...newCandidate, last_name: e.target.value })} placeholder="Иванов" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Начальный этап</label>
                        <Select value={newCandidate.stage} onChange={e => setNewCandidate({ ...newCandidate, stage: e.target.value })}>
                            <option value="New">Новый (New)</option>
                            <option value="Screening">Скрининг (Screening)</option>
                            <option value="Interview">Интервью (Interview)</option>
                        </Select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button type="button" onClick={() => setCandidateModalOpen(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent focus:ring-0 transition-colors">Отмена</Button>
                        <Button type="submit" disabled={createCandidate.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]">
                            {createCandidate.isPending ? 'Добавление...' : 'Добавить'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
