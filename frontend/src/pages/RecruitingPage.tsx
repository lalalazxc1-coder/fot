import React, { useState } from 'react';
import { Plus, Briefcase, Filter, Bell } from 'lucide-react';
import { VacancyList } from '../components/recruiting/VacancyList';
import { CandidateKanban } from '../components/recruiting/CandidateKanban';
import { CommentsSection } from '../components/recruiting/CommentsSection';
import { useVacancies, useCandidates, useVacancy, useUpdateVacancyStatus, useCreateCandidate, useUpdateVacancy, useNotifyCustomer, useUploadCandidateResume } from '../hooks/useRecruiting';
import { useUsers } from '../hooks/useAdmin';
import Modal from '../components/Modal';
import { Button, Input, Select } from '../components/ui-mocks';
import { PageHeader } from '../components/shared';
import { toast } from 'sonner';
import { formatMoney } from '../utils/formatters';
import { formatPhone, isValidEmail, isValidPhone, normalizePhone } from '../utils/validators';

const formatSalaryRange = (salaryFrom?: number | null, salaryTo?: number | null): string | null => {
    if (salaryFrom !== null && salaryFrom !== undefined && salaryTo !== null && salaryTo !== undefined) {
        return `${formatMoney(salaryFrom)} - ${formatMoney(salaryTo)}`;
    }
    if (salaryFrom !== null && salaryFrom !== undefined) {
        return `от ${formatMoney(salaryFrom)}`;
    }
    if (salaryTo !== null && salaryTo !== undefined) {
        return `до ${formatMoney(salaryTo)}`;
    }
    return null;
};

const INITIAL_CANDIDATE_FORM = {
    first_name: '',
    last_name: '',
    stage: 'New',
    phone: '',
    email: '',
};

const ALLOWED_RESUME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_RESUME_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

const MAX_RESUME_UPLOAD_SIZE = 10 * 1024 * 1024;

export default function RecruitingPage() {
    const { data: vacancies = [], isLoading: isLoadingVacancies } = useVacancies();
    const { data: users = [] } = useUsers();

    const [selectedVacancyId, setSelectedVacancyId] = useState<number | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
    const [isVacancyListCollapsed, setVacancyListCollapsed] = useState(true);

    const { data: candidates = [] } = useCandidates(selectedVacancyId || undefined);
    const { data: selectedVacancy } = useVacancy(selectedVacancyId);

    // Modals state
    const [isCandidateModalOpen, setCandidateModalOpen] = useState(false);
    const [isNotifyModalOpen, setNotifyModalOpen] = useState(false);
    const [notifyMessage, setNotifyMessage] = useState('');

    // Form states
    const [newCandidate, setNewCandidate] = useState({ ...INITIAL_CANDIDATE_FORM });
    const [resumeFile, setResumeFile] = useState<File | null>(null);

    const updateVacancyStatus = useUpdateVacancyStatus();
    const updateVacancy = useUpdateVacancy();
    const createCandidate = useCreateCandidate();
    const uploadCandidateResume = useUploadCandidateResume();
    const notifyCustomer = useNotifyCustomer();

    const handleCreateCandidate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVacancyId) return;

        const normalizedPhone = newCandidate.phone.trim() ? normalizePhone(newCandidate.phone) : '';
        if (normalizedPhone && !isValidPhone(normalizedPhone)) {
            toast.error('Введите корректный номер телефона');
            return;
        }

        const normalizedEmail = newCandidate.email.trim().toLowerCase();
        if (normalizedEmail && !isValidEmail(normalizedEmail)) {
            toast.error('Введите корректный email');
            return;
        }

        if (resumeFile && resumeFile.size > MAX_RESUME_UPLOAD_SIZE) {
            toast.error('Максимальный размер резюме: 10MB');
            return;
        }

        if (resumeFile) {
            const extension = resumeFile.name.split('.').pop()?.toLowerCase() || '';
            const hasAllowedMime = ALLOWED_RESUME_TYPES.has((resumeFile.type || '').toLowerCase());
            const hasAllowedExtension = ALLOWED_RESUME_EXTENSIONS.has(extension);
            if (!hasAllowedMime && !hasAllowedExtension) {
                toast.error('Поддерживаются только PDF и Word файлы (.pdf, .doc, .docx)');
                return;
            }
        }

        createCandidate.mutate({
            vacancy_id: selectedVacancyId,
            first_name: newCandidate.first_name,
            last_name: newCandidate.last_name,
            stage: newCandidate.stage,
            phone: normalizedPhone || null,
            email: normalizedEmail || null,
        }, {
            onSuccess: (candidate) => {
                if (!resumeFile) {
                    setCandidateModalOpen(false);
                    setNewCandidate({ ...INITIAL_CANDIDATE_FORM });
                    setResumeFile(null);
                    return;
                }

                uploadCandidateResume.mutate(
                    { candidateId: candidate.id, file: resumeFile },
                    {
                        onSuccess: () => {
                            setCandidateModalOpen(false);
                            setResumeFile(null);
                            setNewCandidate({ ...INITIAL_CANDIDATE_FORM });
                        },
                        onError: () => {
                            setCandidateModalOpen(false);
                            setResumeFile(null);
                            setNewCandidate({ ...INITIAL_CANDIDATE_FORM });
                            toast.warning('Кандидат добавлен, но файл резюме не загрузился. Его можно прикрепить позже через API.');
                        }
                    }
                );
            }
        });
    };

    const handleStatusChange = (status: string) => {
        if (!selectedVacancyId) return;
        updateVacancyStatus.mutate({ id: selectedVacancyId, status });
    };

    const handleAssigneeChange = (assigneeId: string) => {
        if (!selectedVacancyId || !selectedVacancy) return;
        updateVacancy.mutate({
            id: selectedVacancyId,
            payload: {
                assignee_id: assigneeId ? Number(assigneeId) : null
            }
        });
    };

    const handleNotifySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCandidateId || !notifyMessage.trim()) return;

        notifyCustomer.mutate({
            candidateId: selectedCandidateId,
            message: notifyMessage.trim()
        }, {
            onSuccess: () => {
                setNotifyModalOpen(false);
                setNotifyMessage('');
            }
        });
    };

    const salaryRange = formatSalaryRange(selectedVacancy?.salary_from, selectedVacancy?.salary_to);

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-100px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="shrink-0">
                <PageHeader title="Рекрутинг: Воронка кандидатов" />
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
                {/* Left Sidebar: Vacancies */}
                <div className={`w-full shrink-0 h-full flex flex-col min-h-0 transition-all duration-300 ${isVacancyListCollapsed ? 'md:w-[96px] lg:w-[108px]' : 'md:w-[320px] lg:w-[350px]'}`}>
                    {isLoadingVacancies ? (
                        <div className="flex-1 flex justify-center items-center bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <VacancyList
                            vacancies={vacancies}
                            selectedId={selectedVacancyId}
                            collapsed={isVacancyListCollapsed}
                            onToggleCollapsed={() => setVacancyListCollapsed((prev) => !prev)}
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
                        <div className="flex-1 flex flex-col justify-center items-center bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 border-dashed shadow-sm text-center p-8 transition-all">
                            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                                <Filter className="w-10 h-10" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Выберите заявку</h3>
                            <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
                                Нажмите на любую заявку из списка слева, чтобы просмотреть воронку кандидатов, историю работы и комментарии.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="h-3/5 min-h-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex-1 items-center flex flex-wrap gap-4 justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl hidden sm:flex">
                                                    <Briefcase className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedVacancy?.title}</h2>
                                                    <p className="text-xs text-slate-500 font-medium">Кандидатов в воронке: {candidates.length}</p>
                                                    {selectedVacancy?.description && (
                                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{selectedVacancy.description}</p>
                                                    )}
                                                    {salaryRange && (
                                                        <p className="text-xs font-semibold text-emerald-700 mt-1">
                                                            Зарплатная вилка: {salaryRange}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        <div className="flex items-center gap-3">
                                            <Select
                                                title="Исполнитель"
                                                className="text-sm bg-white border-slate-200 font-medium rounded-xl h-[40px] w-auto shadow-sm max-w-[200px] truncate"
                                                value={selectedVacancy?.assignee_id?.toString() || ''}
                                                onChange={(e) => handleAssigneeChange(e.target.value)}
                                            >
                                                <option value="">Не назначен (Любой рекрутер)</option>
                                                {users.map((u: any) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.full_name || u.email}
                                                    </option>
                                                ))}
                                            </Select>
                                            <Select
                                                title="Статус вакансии"
                                                className="text-sm bg-white border-slate-200 font-medium rounded-xl h-[40px] w-auto shadow-sm"
                                                value={selectedVacancy?.status || 'Draft'}
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                            >
                                                <option value="Draft">Черновик (Draft)</option>
                                                <option value="Open">Открыта (Open)</option>
                                                <option value="In Progress">В работе (In Progress)</option>
                                                <option value="Closed">Закрыта (Closed)</option>
                                                <option value="Cancelled">Отменена (Cancelled)</option>
                                            </Select>
                                            {selectedCandidateId && (
                                                <button
                                                    onClick={() => setNotifyModalOpen(true)}
                                                    className="h-[40px] px-4 gap-2 text-sm font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl shadow-sm transition-all active:scale-95 flex items-center shrink-0"
                                                    title="Уведомить заказчика о кандидате"
                                                >
                                                    <Bell className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Уведомить заказчика</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setCandidateModalOpen(true)}
                                                className="h-[40px] px-4 gap-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 flex items-center shrink-0"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span className="hidden sm:inline">Новый кандидат</span>
                                                <span className="sm:hidden">Добавить</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 p-2 overflow-hidden bg-slate-50/50">
                                    <CandidateKanban
                                        candidates={candidates}
                                        selectedCandidateId={selectedCandidateId}
                                        onSelectCandidate={(id: number) => setSelectedCandidateId(id)}
                                    />
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                                <CommentsSection
                                    targetType={selectedCandidateId ? 'candidate' : 'vacancy'}
                                    targetId={selectedCandidateId || selectedVacancyId}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isCandidateModalOpen}
                onClose={() => {
                    setCandidateModalOpen(false);
                    setResumeFile(null);
                    setNewCandidate({ ...INITIAL_CANDIDATE_FORM });
                }}
                title="Новый кандидат"
            >
                <form onSubmit={handleCreateCandidate} className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Имя</label>
                            <Input
                                required
                                value={newCandidate.first_name}
                                onChange={e => setNewCandidate({ ...newCandidate, first_name: e.target.value })}
                                placeholder="Иван"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Фамилия</label>
                            <Input
                                required
                                value={newCandidate.last_name}
                                onChange={e => setNewCandidate({ ...newCandidate, last_name: e.target.value })}
                                placeholder="Иванов"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Начальный этап</label>
                        <Select
                            value={newCandidate.stage}
                            onChange={e => setNewCandidate({ ...newCandidate, stage: e.target.value })}
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        >
                            <option value="New">Новый (New)</option>
                            <option value="Screening">Скрининг (Screening)</option>
                            <option value="Interview">Интервью (Interview)</option>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Телефон</label>
                            <Input
                                value={newCandidate.phone}
                                onChange={e => setNewCandidate({ ...newCandidate, phone: formatPhone(e.target.value) })}
                                placeholder="+7 777 123 45 67"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                            <Input
                                type="email"
                                value={newCandidate.email}
                                onChange={e => setNewCandidate({ ...newCandidate, email: e.target.value })}
                                placeholder="candidate@example.com"
                                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Прикрепить резюме (PDF/DOC/DOCX)</label>
                        <Input
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-300"
                        />
                        {resumeFile && (
                            <p className="mt-1 text-xs text-slate-500">Файл: {resumeFile.name}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            onClick={() => {
                                setCandidateModalOpen(false);
                                setResumeFile(null);
                                setNewCandidate({ ...INITIAL_CANDIDATE_FORM });
                            }}
                            className="bg-white border text-slate-700 hover:bg-slate-50 border-slate-200 transition-colors font-medium px-5 rounded-xl shadow-sm h-[40px]"
                        >
                            Отмена
                        </Button>
                        <button
                            type="submit"
                            disabled={createCandidate.isPending || uploadCandidateResume.isPending}
                            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[140px] font-medium transition-all active:scale-95 shadow-lg shadow-slate-900/20 rounded-xl px-5 h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {createCandidate.isPending || uploadCandidateResume.isPending ? 'Добавление...' : 'Добавить'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Notify Customer Modal */}
            <Modal isOpen={isNotifyModalOpen} onClose={() => { setNotifyModalOpen(false); setNotifyMessage(''); }} title="Уведомить заказчика">
                <form onSubmit={handleNotifySubmit} className="space-y-5">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-3">
                        <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">Уведомление будет отправлено заказчику заявки</p>
                            <p className="text-xs text-amber-700">Заказчик получит уведомление в системе и сможет увидеть ваше сообщение в комментариях к заявке.</p>
                        </div>
                    </div>

                    {selectedCandidateId && (
                        <div className="px-1">
                            <p className="text-xs text-slate-500 font-medium">
                                Кандидат: <span className="text-slate-700 font-semibold">
                                    {candidates.find(c => c.id === selectedCandidateId)?.first_name} {candidates.find(c => c.id === selectedCandidateId)?.last_name}
                                </span>
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Сообщение заказчику</label>
                        <textarea
                            required
                            rows={4}
                            value={notifyMessage}
                            onChange={e => setNotifyMessage(e.target.value)}
                            placeholder="Например: Кандидат успешно прошел собеседование и готов к следующему этапу. Просим согласовать дату встречи."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-100">
                        <Button
                            type="button"
                            onClick={() => { setNotifyModalOpen(false); setNotifyMessage(''); }}
                            className="bg-white border text-slate-700 hover:bg-slate-50 border-slate-200 transition-colors font-medium px-5 rounded-xl shadow-sm h-[40px]"
                        >
                            Отмена
                        </Button>
                        <button
                            type="submit"
                            disabled={notifyCustomer.isPending || !notifyMessage.trim()}
                            className="bg-amber-600 hover:bg-amber-700 text-white min-w-[160px] font-medium transition-all active:scale-95 shadow-lg shadow-amber-600/20 rounded-xl px-5 h-[40px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Bell className="w-4 h-4" />
                            {notifyCustomer.isPending ? 'Отправка...' : 'Отправить уведомление'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
