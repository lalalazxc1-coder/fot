import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Modal from '../Modal';
import { Search, Loader2, CheckCircle, Database, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

interface ImportOneCModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ImportResponse {
    imported: number;
    skipped: number;
}

export default function ImportOneCModal({ isOpen, onClose }: ImportOneCModalProps) {
    const queryClient = useQueryClient();
    const [selectedNames, setSelectedNames] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: employees = [], isLoading, error, refetch } = useQuery<string[]>({
        queryKey: ['onec-employees'],
        queryFn: async () => {
            const res = await api.get<string[]>('/integrations/onec/employees');
            return res.data;
        },
        enabled: isOpen,
        retry: false
    });

    const importMutation = useMutation<ImportResponse, Error, string[]>({
        mutationFn: async (names) => {
            const res = await api.post<ImportResponse>('/integrations/onec/import', { names });
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            toast.success(`Успешно импортировано: ${data.imported}. Пропущено (уже есть): ${data.skipped}`);
            onClose();
        },
        onError: (err) => {
            toast.error(`Ошибка импорта: ${err.message}`);
        }
    });

    const toggleSelect = (name: string) => {
        setSelectedNames(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const toggleSelectAll = () => {
        if (selectedNames.length === filteredEmployees.length) {
            setSelectedNames([]);
        } else {
            setSelectedNames(filteredEmployees);
        }
    };

    const filteredEmployees = employees.filter(name =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImport = () => {
        if (selectedNames.length === 0) return;
        importMutation.mutate(selectedNames);
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedNames([]);
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Импорт сотрудников из 1С"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-100">
                    <Database className="w-5 h-5 flex-shrink-0" />
                    <p>Выберите сотрудников из базы 1С:ЗУП для добавления в систему. Дубликаты по ФИО будут автоматически пропущены.</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Поиск по ФИО..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={toggleSelectAll}>
                            {selectedNames.length > 0 && selectedNames.length === filteredEmployees.length ? (
                                <CheckSquare className="w-4 h-4 text-slate-900" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            <span>ФИО</span>
                        </div>
                        <span>Выбрано: {selectedNames.length}</span>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {isLoading ? (
                            <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p className="text-sm">Получение данных из 1С...</p>
                            </div>
                        ) : error ? (
                            <div className="p-10 flex flex-col items-center justify-center text-red-500 gap-3 text-center">
                                <AlertCircle className="w-8 h-8" />
                                <div>
                                    <p className="text-sm font-bold">Ошибка подключения к 1С</p>
                                    <p className="text-xs opacity-75 mt-1">{(error as any)?.response?.data?.detail || error.message}</p>
                                </div>
                                <button
                                    onClick={() => refetch()}
                                    className="mt-2 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    Попробовать снова
                                </button>
                            </div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">
                                Ничего не найдено
                            </div>
                        ) : (
                            filteredEmployees.map(name => (
                                <div
                                    key={name}
                                    className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${selectedNames.includes(name) ? 'bg-blue-50/30' : ''}`}
                                    onClick={() => toggleSelect(name)}
                                >
                                    <span className="text-sm text-slate-800 font-medium">{name}</span>
                                    {selectedNames.includes(name) ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <div className="w-5 h-5 border-2 border-slate-200 rounded-full" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={selectedNames.length === 0 || importMutation.isPending}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-md shadow-slate-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                        Импортировать выбранных
                    </button>
                </div>
            </div>
        </Modal>
    );
}
