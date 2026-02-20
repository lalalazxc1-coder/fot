import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ArrowUpRight, Eye, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatMoney } from '../../utils';
import { RequestAnalytics } from './RequestAnalytics';

interface RequestDetailsModalProps {
    req: any | null;
    isOpen: boolean;
    onClose: () => void;
    onAction: (id: number, type: 'approved' | 'rejected') => void;
}

export const RequestDetailsModal = ({ req, isOpen, onClose, onAction }: RequestDetailsModalProps) => {
    const pdfRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadPDF = async () => {
        if (!pdfRef.current) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(pdfRef.current, {
                scale: 2,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('pdf-wrapper');
                    if (el) {
                        // Force width for print
                        el.style.width = '800px';
                        el.style.maxWidth = '800px';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';

                        // Change to vertical layout
                        el.classList.remove('md:flex-row');
                        el.classList.add('flex-col');

                        // Show header
                        const header = clonedDoc.getElementById('pdf-header');
                        if (header) header.style.display = 'block';

                        // Make left panel full width
                        const leftPanel = clonedDoc.getElementById('pdf-left-panel');
                        if (leftPanel) {
                            leftPanel.style.maxHeight = 'none';
                            leftPanel.style.overflow = 'visible';
                        }

                        // Hide right panel entirely (Analytics & Actions)
                        const rightPanel = clonedDoc.getElementById('pdf-right-panel');
                        if (rightPanel) {
                            rightPanel.style.display = 'none';
                        }
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // If the content is taller than one page, jsPDF handles it automatically by adding pages conceptually? 
            // Standard approach without page breaks logic: it just fits everything in one long image. 
            // If it exceeds one page height, it will just scale down or clip depending on height params.
            // Let's add multiple pages if height exceeds A4 height
            const pageHeight = pdf.internal.pageSize.getHeight();
            let heightLeft = pdfHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Заявка_${req.employee_details?.name?.replace(/\s+/g, '_') || req.id}.pdf`);
        } catch (error) {
            console.error("PDF generation failed", error);
        } finally {
            setIsDownloading(false);
        }
    };

    // Lock scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen || !req) return null;

    const isRaise = req.type === 'raise';
    const diff = req.requested_value - req.current_value;

    return createPortal(
        <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div id="pdf-wrapper" ref={pdfRef} className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Print Header (Hidden on screen) */}
                <div id="pdf-header" style={{ display: 'none' }} className="w-full bg-slate-900 text-white px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded-md">
                                <svg className="w-5 h-5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight leading-tight">HR & Payroll Hub</h1>
                                <p className="text-slate-400 text-[10px]">Автоматизированная система управления ФОТ</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-300">ПРОТОКОЛ АНАЛИЗА ЗАЯВКИ</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Отпечатано: {new Date().toLocaleDateString('ru-RU')} {new Date().toLocaleTimeString('ru-RU')}</p>
                        </div>
                    </div>
                </div>

                {/* Left Panel: Request Info */}
                <div id="pdf-left-panel" className="flex-1 p-8 overflow-y-auto">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {req.status === 'pending' ? 'Ожидает' : req.status === 'approved' ? 'Согласовано' : 'Отклонено'}
                                </span>
                                <span className="text-slate-400 text-xs">#{req.id}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">{req.employee_details.name}</h2>
                            <p className="text-slate-500">{req.employee_details.position} • {req.employee_details.department || req.employee_details.branch}</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Financial Card */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Тип запроса</div>
                                    <div className="font-medium text-slate-700">{isRaise ? 'Повышение оклада' : 'Разовый бонус'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">{isRaise ? 'Прирост' : 'Сумма'}</div>
                                    <div className={`text-xl font-bold ${isRaise ? 'text-emerald-600' : 'text-purple-600'}`}>
                                        +{formatMoney(isRaise ? diff : req.requested_value)}
                                    </div>
                                </div>
                            </div>

                            {isRaise && (
                                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                    <div>
                                        <div className="text-xs text-slate-400 mb-0.5">Текущий оклад</div>
                                        <div className="font-mono text-slate-600">{formatMoney(req.current_value)}</div>
                                    </div>
                                    <ArrowUpRight className="w-5 h-5 text-slate-300" />
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 mb-0.5">Новый оклад</div>
                                        <div className="font-mono text-slate-900 font-bold">{formatMoney(req.requested_value)}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2">Обоснование</h3>
                            <div className="text-slate-600 text-sm leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                {req.reason}
                            </div>
                        </div>

                        {/* History Timeline */}
                        <div>
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" /> История согласований
                            </h3>
                            <div className="space-y-4 pl-2 border-l-2 border-slate-100 ml-2">
                                {req.history.map((h: any) => (
                                    <div key={h.id} className="relative pl-6 pb-2">
                                        <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${h.action === 'approved' ? 'bg-emerald-500' :
                                            h.action === 'rejected' ? 'bg-red-500' : 'bg-slate-300'
                                            }`} />
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-500">{h.created_at}</span>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${h.action === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                                    h.action === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {h.action === 'created' ? 'Создано' :
                                                        h.action === 'approved' ? 'Согласовано' :
                                                            h.action === 'rejected' ? 'Отклонено' : h.action}
                                                </span>
                                            </div>
                                            <div className="text-sm font-medium text-slate-900">
                                                {h.actor_name || 'Система'}
                                            </div>
                                            {h.actor_role && <div className="text-xs text-slate-500">{h.actor_role}</div>}
                                            {h.comment && !h.comment.toLowerCase().includes('created request') && (
                                                <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                                    "{h.comment}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Analytics & Actions */}
                <div id="pdf-right-panel" className="md:w-96 bg-slate-50 border-l border-slate-200 flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-white">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                            <Eye className="w-4 h-4" /> Аналитика
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <RequestAnalytics reqId={req.id} />
                    </div>

                    {/* Quick Actions Footer (Sticky) */}
                    <div id="pdf-actions" className="p-6 bg-white border-t border-slate-200 space-y-3">
                        {req.can_approve && req.status === 'pending' && (
                            <div className={`grid gap-3 ${req.is_final ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {!req.is_final && (
                                    <button
                                        onClick={() => onAction(req.id, 'rejected')}
                                        className="px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold border border-red-100 transition-colors"
                                    >
                                        Отклонить
                                    </button>
                                )}
                                <button
                                    onClick={() => onAction(req.id, 'approved')}
                                    className={`px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 ${req.is_final ? 'w-full' : ''}`}
                                >
                                    {req.is_final ? 'Утвердить' : 'Согласовать'}
                                </button>
                            </div>
                        )}

                        {req.status === 'approved' && (
                            <button
                                onClick={downloadPDF}
                                disabled={isDownloading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold border border-blue-100 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                {isDownloading ? "Генерация PDF..." : "Сохранить в PDF"}
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
