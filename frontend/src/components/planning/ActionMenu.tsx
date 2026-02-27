import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit2, History, Trash2, X } from 'lucide-react';
import { PlanRow } from '../../hooks/usePlanning';

interface ActionMenuProps {
    row: PlanRow;
    onHistory: (id: number) => void;
    onEdit: (row: PlanRow) => void;
    onDelete: (id: number) => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ row, onHistory, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Закрыть меню при клике вне его области
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative flex justify-end items-center h-full pr-2" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`p-1.5 rounded-lg transition-all border ${isOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600 shadow-sm'}`}
                title="Действия"
            >
                {isOpen ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
            </button>

            {/* Выпадающее меню */}
            {isOpen && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white p-1 rounded-xl shadow-lg border border-slate-200 z-50 animate-in fade-in slide-in-from-right-2 duration-200">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onHistory(row.id); }}
                        className="flex items-center justify-center p-2 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors group relative"
                        title="История"
                    >
                        <History className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>

                    <div className="w-px h-4 bg-slate-200/60 mx-0.5"></div>

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(row); }}
                        className="flex items-center justify-center p-2 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors group relative"
                        title="Редактировать"
                    >
                        <Edit2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>

                    <div className="w-px h-4 bg-slate-200/60 mx-0.5"></div>

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDelete(row.id); }}
                        className="flex items-center justify-center p-2 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition-colors group relative"
                        title="Удалить"
                    >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );
};
