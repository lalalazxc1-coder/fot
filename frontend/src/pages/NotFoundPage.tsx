import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 font-sans antialiased text-slate-900">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            <div className="max-w-xl w-full relative z-10">
                <div className="flex flex-col items-start space-y-8">
                    {/* Error Indicator */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div className="h-px w-12 bg-slate-200"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Error Code 404</span>
                    </div>

                    {/* Main Content */}
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none uppercase">
                            Запрос отклонен
                        </h1>
                        <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-md">
                            Запрашиваемый ресурс недоступен или не существует. Проверьте правильность введенного адреса.
                        </p>
                    </div>

                    {/* Navigation Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="h-14 px-8 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Вернуться назад
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="h-14 px-8 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10"
                        >
                            <Home className="w-4 h-4" />
                            На главную
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
