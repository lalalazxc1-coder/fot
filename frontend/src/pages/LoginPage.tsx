import React, { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

import { api } from '../lib/api';
import type { AuthUser } from '../types';
import { getErrorMessage } from '../utils/api-helpers';

export default function LoginPage({ onLogin }: { onLogin: (user: AuthUser, rememberMe: boolean) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
    const [inputErrors, setInputErrors] = useState({ username: false, password: false });
    const [showPassword, setShowPassword] = useState(false);
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('remembered_username');
        if (saved) {
            setUsername(saved);
            setRememberMe(true);
        }

        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) setGreeting('Доброе утро');
        else if (hour >= 12 && hour < 18) setGreeting('Добрый день');
        else if (hour >= 18 && hour < 23) setGreeting('Добрый вечер');
        else setGreeting('Доброй ночи');
    }, []);

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
            const res = await api.post('/auth/login', {
                username, password, remember_me: rememberMe
            });

            const data = res.data;
            const userData = {
                id: data.user_id,
                full_name: data.full_name,
                email: data.email,
                contact_email: data.contact_email,
                phone: data.phone,
                role: data.role,
                permissions: data.permissions || {},
                scope_branches: data.scope_branches,
                scope_departments: data.scope_departments,
                avatar_url: data.avatar_url,
                job_title: data.job_title,
                employee_id: data.employee_id,
            };

            setLoggedInUser(data.full_name);
            setIsSuccess(true);
            setIsLoading(false);

            setTimeout(() => {
                if (rememberMe) {
                    localStorage.setItem('remembered_username', username);
                } else {
                    localStorage.removeItem('remembered_username');
                }
                onLogin(userData, rememberMe);
            }, 1500);

        } catch (e: unknown) {
            setError(getErrorMessage(e));
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 font-sans bg-slate-100 relative overflow-hidden">
            {/* Split Layout Container */}
            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-300/60 overflow-hidden flex flex-col md:flex-row relative z-10 min-h-[600px] border border-slate-100/50">

                {/* Left Side - Info */}
                <div className="md:w-5/12 bg-[#f8fafc] p-8 sm:p-14 flex flex-col justify-center relative border-r border-slate-100/50">
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-blue-50/50 via-transparent to-indigo-50/30 pointer-events-none" />

                    <div className="relative z-10 mb-auto">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                HR & Payroll<span className="font-medium text-[#94a3b8]">Hub</span>
                            </h1>
                        </div>
                    </div>

                    <div className="relative z-10 mt-20 mb-12">
                        <h2 className="text-[44px] lg:text-[52px] font-[900] text-[#0f172a] leading-[1.05] tracking-[-0.04em]">
                            Цифровая<br />
                            экосистема<br />
                            управления<br />
                            персоналом
                        </h2>
                    </div>

                    <div className="relative z-10 mt-auto opacity-40">
                        <div className="h-1 w-12 bg-slate-900 rounded-full mb-4"></div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-sans">Enterprise Solution</p>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="md:w-7/12 p-8 sm:p-12 lg:p-16 flex flex-col justify-center bg-white relative">
                    {/* Success Animation Overlay */}
                    <div className={`absolute inset-0 bg-white z-20 flex flex-col items-center justify-center transition-all duration-500 ${isSuccess ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'}`}>
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-100/50">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Успешно!</h2>
                        <p className="text-slate-500 font-medium">С возвращением, {loggedInUser}</p>
                        <div className="mt-8">
                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className={`max-w-md mx-auto w-full transition-all duration-500 ${isSuccess ? 'opacity-0 blur-sm translate-y-4' : 'opacity-100 blur-0 translate-y-0'}`}>
                        <div className="mb-10">
                            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">{greeting}</h2>
                            <p className="text-slate-500 text-sm font-medium">Пожалуйста, введите ваши данные для входа в систему.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider pl-1 ${inputErrors.username ? 'text-red-500' : 'text-slate-700'}`}>Логин или Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className={`h-5 w-5 ${inputErrors.username ? 'text-red-400' : 'text-slate-400'}`} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        autoComplete="username"
                                        onChange={(e) => {
                                            setUsername(e.target.value);
                                            if (inputErrors.username) setInputErrors(prev => ({ ...prev, username: false }));
                                        }}
                                        className={`w-full h-12 pl-12 pr-4 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium ${inputErrors.username
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-slate-200 focus:ring-slate-900/10 focus:border-slate-900/40 hover:border-slate-300'
                                            }`}
                                        placeholder="Введите ваш логин"
                                        disabled={isLoading || isSuccess}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`block text-xs font-bold uppercase tracking-wider pl-1 ${inputErrors.password ? 'text-red-500' : 'text-slate-700'}`}>Пароль</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className={`h-5 w-5 ${inputErrors.password ? 'text-red-400' : 'text-slate-400'}`} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        autoComplete="current-password"
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (inputErrors.password) setInputErrors(prev => ({ ...prev, password: false }));
                                        }}
                                        className={`w-full h-12 pl-12 pr-12 bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-900 placeholder:text-slate-400 text-sm font-medium ${inputErrors.password
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-slate-200 focus:ring-slate-900/10 focus:border-slate-900/40 hover:border-slate-300'
                                            }`}
                                        placeholder="••••••••"
                                        disabled={isLoading || isSuccess}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                        tabIndex={-1}
                                        disabled={isLoading || isSuccess}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                        ) : (
                                            <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900/20 checked:bg-slate-900 checked:border-slate-900 transition-all hover:border-slate-400"
                                            disabled={isLoading || isSuccess}
                                        />
                                        <svg
                                            className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                                            viewBox="0 0 14 10"
                                            fill="none"
                                        >
                                            <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Запомнить меня</span>
                                </label>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm p-3.5 rounded-xl border border-red-100 flex items-center justify-center font-medium shadow-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || isSuccess}
                                className="w-full bg-black hover:bg-slate-800 text-white font-bold h-12 rounded-xl transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-4"
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

                        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                            <p className="text-xs font-medium text-slate-400">
                                &copy; {new Date().getFullYear()} Вход только для зарегистрированных пользователей.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
