import React, { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [inputErrors, setInputErrors] = useState({ username: false, password: false });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const errors = {
            username: !username.trim(),
            password: !password.trim()
        };

        setInputErrors(errors);

        if (errors.username || errors.password) {
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                let errMsg = err.detail || 'Ошибка авторизации';

                // Translate common backend errors
                if (errMsg === 'User not found') errMsg = 'Пользователь не найден';
                if (errMsg === 'Incorrect password') errMsg = 'Неверный пароль';

                throw new Error(errMsg);
            }

            const data = await res.json();
            const userData = {
                id: data.user_id,
                full_name: data.full_name,
                role: data.role,
                permissions: data.permissions || {},
                scope_branches: data.scope_branches,
                scope_departments: data.scope_departments,
                access_token: data.access_token
            };

            // Small delay for better UX
            setTimeout(() => {
                onLogin(userData);
            }, 500);

        } catch (e: any) {
            setError(e.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-slate-50 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/40 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100/40 blur-[100px]" />
            </div>

            <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl shadow-slate-200/50 border border-white/50 p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-500">

                {/* Logo Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl shadow-slate-900/20 flex items-center justify-center mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-center">HR & Payroll Hub</h1>
                    <p className="text-slate-500 text-sm mt-2 text-center font-medium">Корпоративный портал управления персоналом</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className={`block text-xs font-bold uppercase tracking-widest pl-1 ${inputErrors.username ? 'text-red-500' : 'text-slate-500'}`}>Логин или Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (inputErrors.username) setInputErrors(prev => ({ ...prev, username: false }));
                            }}
                            className={`w-full h-11 px-4 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium shadow-sm ${inputErrors.username
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                                }`}
                            placeholder="Введите ваш логин"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className={`block text-xs font-bold uppercase tracking-widest pl-1 ${inputErrors.password ? 'text-red-500' : 'text-slate-500'}`}>Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (inputErrors.password) setInputErrors(prev => ({ ...prev, password: false }));
                            }}
                            className={`w-full h-11 px-4 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium shadow-sm ${inputErrors.password
                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                                }`}
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-center justify-center font-medium animate-in fade-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                        ) : (
                            <>
                                Войти в систему
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-400 font-medium">
                        &copy; {new Date().getFullYear()} Доступ только для авторизованных сотрудников.
                    </p>
                </div>
            </div>
        </div>
    );
}
