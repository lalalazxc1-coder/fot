import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from './ui-mocks';
import { Trash2, Plus, Users, Building, Shield, CheckCircle, XCircle } from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

type Branch = {
    id: number;
    name: string;
    departments: { id: number; name: string }[];
};

type Role = {
    id: number;
    name: string;
    permissions: Record<string, boolean>;
};

type User = {
    id: number;
    email: string;
    role_name: string;
    full_name: string;
};

// Possible permissions list
const PERMISSIONS_LIST = [
    { key: 'view_fot', label: 'Просмотр ФОТ' },
    { key: 'edit_financials', label: 'Редактирование ЗП/KPI' },
    { key: 'manage_users', label: 'Управление пользователями' },
    { key: 'manage_structure', label: 'Настройка Филиалов' },
    { key: 'view_audit', label: 'Просмотр Аудита' },
];

export default function AdminPanel() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    // Forms
    const [newBranch, setNewBranch] = useState('');
    const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role_id: '' });

    // Role Creation State
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePerms, setNewRolePerms] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchStructure();
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchStructure = async () => {
        const res = await fetch(`${API_URL}/structure`);
        setBranches(await res.json());
    };

    const fetchUsers = async () => {
        const res = await fetch(`${API_URL}/users`);
        setUsers(await res.json());
    }

    const fetchRoles = async () => {
        const res = await fetch(`${API_URL}/roles`);
        setRoles(await res.json());
    }

    const handleCreateBranch = async () => {
        if (!newBranch) return;
        await fetch(`${API_URL}/structure/branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newBranch, type: 'branch' })
        });
        setNewBranch('');
        fetchStructure();
    };

    const handleCreateDept = async (branchId: number) => {
        const name = prompt("Название отдела (подразделения):");
        if (!name) return;
        await fetch(`${API_URL}/structure/department`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type: 'department', parent_id: branchId })
        });
        fetchStructure();
    };

    const handleCreateRole = async () => {
        if (!newRoleName) return;
        await fetch(`${API_URL}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newRoleName, permissions: newRolePerms })
        });
        setNewRoleName('');
        setNewRolePerms({});
        setIsCreatingRole(false);
        fetchRoles();
    };

    const togglePerm = (key: string) => {
        setNewRolePerms(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newUser, role_id: parseInt(newUser.role_id) })
        });
        setNewUser({ email: '', full_name: '', password: '', role_id: '' });
        fetchUsers();
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Административная панель</h1>
                    <p className="text-slate-500">Настройка доступа и структуры организации</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">

                {/* 1. Roles & Users */}
                <div className="space-y-6">

                    {/* Roles Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" /> Роли и Доступы</h2>
                            <button onClick={() => setIsCreatingRole(!isCreatingRole)} className="text-sm text-blue-600 font-medium hover:underline">
                                {isCreatingRole ? 'Отмена' : '+ Создать роль'}
                            </button>
                        </div>

                        {isCreatingRole && (
                            <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100 animate-in slide-in-from-top-2">
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Название Роли</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Например: Региональный Директор"
                                    value={newRoleName}
                                    onChange={e => setNewRoleName(e.target.value)}
                                />
                                <div className="space-y-2 mb-4">
                                    <label className="block text-xs font-bold uppercase text-slate-500">Разрешения:</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PERMISSIONS_LIST.map(perm => (
                                            <label key={perm.key} className="flex items-center gap-2 text-sm bg-white p-2 rounded border cursor-pointer hover:border-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={!!newRolePerms[perm.key]}
                                                    onChange={() => togglePerm(perm.key)}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                {perm.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleCreateRole} className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800">Сохранить Роль</button>
                            </div>
                        )}

                        <div className="space-y-3">
                            {roles.length === 0 && <p className="text-sm text-slate-400">Ролей пока нет. Создайте первую.</p>}
                            {roles.map(role => (
                                <div key={role.id} className="border p-3 rounded-lg hover:border-blue-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-slate-800">{role.name}</span>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">ID: {role.id}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(role.permissions).filter(([_, v]) => v).map(([key]) => {
                                            const label = PERMISSIONS_LIST.find(p => p.key === key)?.label || key;
                                            return <span key={key} className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">{label}</span>
                                        })}
                                        {Object.keys(role.permissions).length === 0 && <span className="text-[10px] text-slate-400">Нет прав</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Users Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-blue-600" /> Пользователи</h2>

                        <form onSubmit={handleCreateUser} className="space-y-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <h3 className="text-xs font-bold uppercase text-slate-500">Добавить пользователя</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <input required className="w-full border rounded px-3 py-2 text-sm" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                <input required className="w-full border rounded px-3 py-2 text-sm" placeholder="ФИО" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input required className="w-full border rounded px-3 py-2 text-sm" type="password" placeholder="Пароль" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                <select
                                    className="w-full border rounded px-3 py-2 text-sm"
                                    value={newUser.role_id}
                                    onChange={e => setNewUser({ ...newUser, role_id: e.target.value })}
                                    required
                                >
                                    <option value="">Выберите роль...</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <button className="w-full bg-emerald-600 text-white py-2 rounded text-sm hover:bg-emerald-700 font-medium">Создать пользователя</button>
                        </form>

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {users.map(u => (
                                <div key={u.id} className="flex justify-between items-center p-3 border-b text-sm hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                            {u.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">{u.full_name}</div>
                                            <div className="text-xs text-slate-500">{u.email}</div>
                                        </div>
                                    </div>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium border border-slate-200">{u.role_name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* 2. Structure */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Building className="w-5 h-5 text-blue-600" /> Структура (Филиалы)</h2>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Название нового филиала..."
                                value={newBranch}
                                onChange={e => setNewBranch(e.target.value)}
                            />
                            <button onClick={handleCreateBranch} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 font-medium">Создать</button>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {branches.length === 0 && <p className="text-center text-slate-400 py-10">Структура пуста</p>}
                            {branches.map(b => (
                                <div key={b.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                                        <span className="font-bold text-slate-800">{b.name}</span>
                                        <button onClick={() => handleCreateDept(b.id)} className="text-xs bg-white border border-slate-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors font-medium">
                                            + Отдел
                                        </button>
                                    </div>
                                    <div className="p-3 bg-white">
                                        {b.departments.length === 0 && <span className="text-xs text-slate-400 italic pl-1">Нет отделов</span>}
                                        <ul className="space-y-2">
                                            {b.departments.map(d => (
                                                <li key={d.id} className="text-sm text-slate-600 flex items-center gap-2 p-1 hover:bg-slate-50 rounded">
                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                                    {d.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
