import React, { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { useLocation, Navigate } from 'react-router-dom';

const API_URL = 'http://localhost:8000/api';

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Ошибка авторизации');
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

            onLogin(userData); // Pass up to App

        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-slate-100/80 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/50 to-slate-200/80">
            <div className="max-w-[400px] w-full bg-white rounded-3xl p-10 sm:p-12 shadow-2xl shadow-slate-200/60 border border-white/50">

                <div className="flex flex-col items-center mb-10">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center justify-center mb-6">
                        <Briefcase className="text-white w-5 h-5" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight text-center">Добро пожаловать</h1>
                    <p className="text-slate-400 text-sm mt-2 text-center font-medium">Войдите в свой рабочий профиль</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Email</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-300 text-base"
                            placeholder="user@name.com"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 transition-all text-slate-900 placeholder:text-slate-300 text-base"
                            placeholder="Введите пароль"
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm bg-red-50/50 p-3 rounded-xl border border-red-100 flex items-center justify-center font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-br from-slate-800 to-slate-950 text-white font-bold py-3.5 rounded-xl hover:shadow-xl hover:shadow-slate-900/20 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] mt-2"
                    >
                        Вход
                    </button>
                </form>
            </div>
        </div>
    );
}
