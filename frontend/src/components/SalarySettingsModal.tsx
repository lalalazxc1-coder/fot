import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';
import { Button, Input } from './ui-mocks';
import { SalaryConfig, DEFAULT_CONFIG } from '../utils/salary';
import { HelpCircle } from 'lucide-react';

export default function SalarySettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [config, setConfig] = useState<SalaryConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'settings' | 'history'>('settings');
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            api.get('/salary-config').then(res => setConfig(res.data)).catch(console.error);
            if (tab === 'history') loadHistory();
        }
    }, [isOpen, tab]);

    const loadHistory = () => {
        api.get('/salary-config/history').then(res => setHistory(res.data)).catch(console.error);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/salary-config', config);
            onClose();
            alert('Настройки сохранены');
        } catch (e) {
            console.error(e);
            alert('Ошибка сохранения');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: keyof SalaryConfig, val: string) => {
        const num = parseFloat(val);
        setConfig(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    };

    const handlePercentChange = (key: keyof SalaryConfig, val: string) => {
        const num = parseFloat(val);
        // Convert Percentage to Decimal (10 -> 0.1)
        setConfig(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num / 100 }));
    };

    const PercentInput = ({ label, valueKey, desc }: { label: string, valueKey: keyof SalaryConfig, desc: string }) => (
        <div>
            <div className="flex justify-between items-center mb-0.5">
                <div className="group relative">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-help">
                        {label}
                        <HelpCircle className="w-3 h-3 text-slate-300" />
                    </label>
                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl hidden group-hover:block z-50 font-normal leading-normal animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                        {desc}
                        <div className="absolute -bottom-1 left-3 w-2 h-2 bg-slate-800 rotate-45 transform"></div>
                    </div>
                </div>
            </div>
            <div className="relative">
                <Input
                    type="number"
                    step="0.1"
                    className="pr-8 font-medium h-8 text-sm"
                    value={Math.round((config[valueKey] as number) * 100 * 100) / 100}
                    onChange={e => handlePercentChange(valueKey, e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Настройки расчета" maxWidth="max-w-4xl">
            <div className="flex gap-6 border-b border-slate-200 mb-3">
                <button
                    onClick={() => setTab('settings')}
                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-[1px] ${tab === 'settings' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'}`}
                >
                    Параметры
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-[1px] ${tab === 'history' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'}`}
                >
                    История изменений
                </button>
            </div>

            {tab === 'history' ? (
                /* History Tab Content (Compact) */
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {history.length === 0 && <p className="text-center text-slate-400 py-8">История изменений пуста</p>}
                    {history.map(log => (
                        <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-sm">
                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100">
                                <span className="font-bold text-slate-700">{log.user || 'Система'}</span>
                                <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="space-y-1">
                                {Object.keys(log.new_values || {}).map(key => {
                                    const labels: Record<string, string> = {
                                        mrp: 'МРП', mzp: 'МЗП',
                                        opv_rate: 'ОПВ', opvr_rate: 'ОПВР', vosms_rate: 'ВОСМС',
                                        vosms_employer_rate: 'ОСМС', so_rate: 'СО', sn_rate: 'СН', ipn_rate: 'ИПН',
                                        opv_limit_mzp: 'Лимит ОПВ', vosms_limit_mzp: 'Лимит ВОСМС', ipn_deduction_mrp: 'Вычет ИПН'
                                    };
                                    const formatVal = (k: string, v: any) => k.includes('rate') ? `${Math.round(Number(v) * 100 * 10) / 10}% ` : v;
                                    return (
                                        <div key={key} className="flex gap-2">
                                            <span className="font-bold text-slate-500 w-24">{labels[key] || key}:</span>
                                            <span className="line-through text-slate-400">{formatVal(key, log.old_values?.[key])}</span>
                                            <span>→</span>
                                            <span className="font-bold text-emerald-600">{formatVal(key, log.new_values?.[key])}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <form onSubmit={handleSave} className="space-y-4">

                    {/* 1. Base Constants & Button Row */}
                    <div className="flex gap-4 items-end">
                        <div className="w-32">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">МРП (KZT)</label>
                            <Input type="number" className="font-bold text-slate-800 h-8" value={config.mrp} onChange={e => handleChange('mrp', e.target.value)} />
                        </div>
                        <div className="w-32">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">МЗП (KZT)</label>
                            <Input type="number" className="font-bold text-slate-800 h-8" value={config.mzp} onChange={e => handleChange('mzp', e.target.value)} />
                        </div>
                        <div className="flex-1"></div>
                        <Button disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 px-6 rounded-lg text-sm">
                            {loading ? '...' : 'Сохранить'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* 2. Employee Taxes */}
                        <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs border-b border-slate-200 pb-1">
                                <span className="bg-emerald-100 text-emerald-700 w-4 h-4 rounded-full flex items-center justify-center text-[10px]">1</span>
                                С работника (Net)
                            </h4>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                <PercentInput label="ОПВ" valueKey="opv_rate" desc={`Обязательные пенсионные взносы(вычитаются из оклада).Лимит: ${config.opv_limit_mzp} МЗП(${(config.opv_limit_mzp * config.mzp).toLocaleString()} ₸)`} />
                                <PercentInput label="ВОСМС" valueKey="vosms_rate" desc={`Взносы на мед.страхование работника.Лимит: ${config.vosms_limit_mzp} МЗП(${(config.vosms_limit_mzp * config.mzp).toLocaleString()} ₸)`} />
                                <PercentInput label="ИПН" valueKey="ipn_rate" desc="Индивидуальный подоходный налог. Взимается после вычета ОПВ, ВОСМС и 14 МРП." />
                            </div>
                        </div>

                        {/* 3. Employer Taxes */}
                        <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs border-b border-slate-200 pb-1">
                                <span className="bg-blue-100 text-blue-700 w-4 h-4 rounded-full flex items-center justify-center text-[10px]">2</span>
                                С работодателя
                            </h4>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                <PercentInput label="ОПВР" valueKey="opvr_rate" desc={`ОПВ Работодателя.Лимит: ${config.opv_limit_mzp} МЗП(${(config.opv_limit_mzp * config.mzp).toLocaleString()} ₸)`} />
                                <PercentInput label="ОСМС" valueKey="vosms_employer_rate" desc="Отчисления на мед. страхование (платит работодатель)." />
                                <PercentInput label="СО" valueKey="so_rate" desc="Социальные отчисления (база: оклад минус ОПВ). Лимит: 7 МЗП." />
                                <PercentInput label="СН" valueKey="sn_rate" desc="Социальный налог (уменьшается на сумму СО)." />
                            </div>
                        </div>
                    </div>

                    {/* 4. Limits & Deductions - Compact Row */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Лимит ОПВ / ОПВР</label>
                            <div className="relative">
                                <Input type="number" className="pr-10 font-medium h-8 text-sm" value={config.opv_limit_mzp} onChange={e => handleChange('opv_limit_mzp', e.target.value)} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">МЗП</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{(config.opv_limit_mzp * config.mzp).toLocaleString()} ₸</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Лимит ВОСМС</label>
                            <div className="relative">
                                <Input type="number" className="pr-10 font-medium h-8 text-sm" value={config.vosms_limit_mzp} onChange={e => handleChange('vosms_limit_mzp', e.target.value)} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">МЗП</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{(config.vosms_limit_mzp * config.mzp).toLocaleString()} ₸</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Вычет ИПН</label>
                            <div className="relative">
                                <Input type="number" className="pr-10 font-medium h-8 text-sm" value={config.ipn_deduction_mrp} onChange={e => handleChange('ipn_deduction_mrp', e.target.value)} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">МРП</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{(config.ipn_deduction_mrp * config.mrp).toLocaleString()} ₸</p>
                        </div>
                    </div>
                </form>
            )}
        </Modal>
    );
}

