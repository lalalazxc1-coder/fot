import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './lib/api';
import { SnapshotProvider } from './context/SnapshotContext';
import type { AuthUser } from './types';

const EmployeeTable = lazy(() => import('./components/EmployeeTable'));
const PlanningTable = lazy(() => import('./components/PlanningTable'));
const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const RequestsPage = lazy(() => import('./pages/RequestsPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage'));
const JobOffersPage = lazy(() => import('./pages/JobOffersPage'));
const RecruitingPage = lazy(() => import('./pages/RecruitingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicOfferPage = lazy(() => import('./pages/requests/PublicOfferPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const EmployeeViewPage = lazy(() => import('./pages/EmployeeViewPage'));

// Admin sub-pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const StructurePage = lazy(() => import('./pages/admin/StructurePage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const WorkflowPage = lazy(() => import('./pages/admin/WorkflowPage'));
const IntegrationsPage = lazy(() => import('./pages/admin/IntegrationsPage'));
const AnalyticsSettingsPage = lazy(() => import('./pages/admin/AnalyticsSettingsPage'));
const LogsPage = lazy(() => import('./pages/admin/LogsPage'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const PositionsPage = lazy(() => import('./pages/settings/PositionsPage'));
const OfferTemplatesPage = lazy(() => import('./pages/settings/OfferTemplatesPage'));
const WelcomePagesPage = lazy(() => import('./pages/settings/WelcomePagesPage'));

// Security Wrappers
const ProtectedAdminRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAdminAccess = user.role === 'Administrator' || user.permissions?.admin_access;
    if (!hasAdminAccess) {
        return <Navigate to="/" replace />;
    }
    return children;
};

const ProtectedSettingsRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' ||
        user.permissions?.admin_access ||
        user.permissions?.view_structure ||
        user.permissions?.edit_structure ||
        user.permissions?.view_positions ||
        user.permissions?.edit_positions;

    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }
    return children;
};

const ProtectedMarketRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_market;
    if (!hasAccess) {
        return <Navigate to="/" replace />;
    }
    return children;
};

const ProtectedAnalyticsRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_analytics;
    if (!hasAccess) return <Navigate to="/requests" replace />;
    return children;
};

const ProtectedPayrollRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_payroll;
    if (!hasAccess) return <Navigate to="/requests" replace />;
    return children;
};

const ProtectedEmployeesRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_employees;
    if (!hasAccess) return <Navigate to="/requests" replace />;
    return children;
};

const ProtectedScenariosRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_scenarios;
    if (!hasAccess) return <Navigate to="/requests" replace />;
    return children;
};

const ProtectedOffersRoute = ({ user, children }: { user: AuthUser, children: JSX.Element }) => {
    const hasAccess = user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.manage_planning || user.permissions?.manage_offers;
    if (!hasAccess) return <Navigate to="/requests" replace />;
    return children;
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const persistUser = (nextUser: AuthUser, preferredStorage: 'local' | 'session' | null = null) => {
        const payload = JSON.stringify(nextUser);

        if (preferredStorage === 'local') {
            localStorage.setItem('fot_user', payload);
            sessionStorage.removeItem('fot_user');
            return;
        }

        if (preferredStorage === 'session') {
            sessionStorage.setItem('fot_user', payload);
            localStorage.removeItem('fot_user');
            return;
        }

        if (localStorage.getItem('fot_user')) {
            localStorage.setItem('fot_user', payload);
        } else {
            sessionStorage.setItem('fot_user', payload);
        }
    };

    // Check localStorage on mount & refresh user data
    useEffect(() => {
        const initAuth = async () => {
            const storedUserRaw = localStorage.getItem('fot_user') || sessionStorage.getItem('fot_user');

            // Быстро установить данные из storage для мгновенного UI (без мерцания)
            if (storedUserRaw) {
                try {
                    const storedUser = JSON.parse(storedUserRaw);
                    setUser(storedUser);
                    setIsAuthenticated(true);
                } catch (e) {
                    console.error("Failed to parse user", e);
                }
            }

            // Всегда проверяем /auth/me — HttpOnly cookie может существовать
            // даже если sessionStorage пуст (новая вкладка, перезапуск браузера).
            // Без этого вызова cookie-based auth не работает в новых вкладках.
            try {
                const response = await api.get('/auth/me');
                const freshUser = response.data as AuthUser;
                setUser(freshUser);
                setIsAuthenticated(true);

                // Синхронизируем storage актуальными данными профиля
                persistUser(freshUser);
            } catch (err: unknown) {
                // 401 — cookie невалидный или отсутствует
                const status = (err as { response?: { status?: number } })?.response?.status;
                if (status !== 401) {
                    console.error("Ошибка при проверке сессии:", err);
                }
                localStorage.removeItem('fot_user');
                sessionStorage.removeItem('fot_user');
                setUser(null);
                setIsAuthenticated(false);
            }

            setLoading(false);
        };

        initAuth();

        const handleSessionExpired = () => {
            setIsAuthenticated(false);
            setUser(null);
            localStorage.removeItem('fot_user');
            sessionStorage.removeItem('fot_user');
        };

        window.addEventListener('session-expired', handleSessionExpired);
        return () => window.removeEventListener('session-expired', handleSessionExpired);
    }, []);

    const handleLogin = (userData: AuthUser, rememberMe: boolean = false) => {
        setUser(userData);
        setIsAuthenticated(true);
        persistUser(userData, rememberMe ? 'local' : 'session');
    };

    const handleUserUpdate = (nextUser: AuthUser) => {
        setUser(nextUser);
        persistUser(nextUser);
    };

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) { console.error('Logout error', e); }
        localStorage.removeItem('fot_user');
        sessionStorage.removeItem('fot_user');
        setIsAuthenticated(false);
        setUser(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <SnapshotProvider>
            <Suspense
                fallback={
                    <div className="min-h-screen flex items-center justify-center bg-slate-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                }
            >
                <Routes>
                    <Route path="/login" element={
                        !isAuthenticated ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" replace />
                    } />

                    <Route path="/public/offer/:token" element={<PublicOfferPage />} />

                    {/* Protected Routes */}
                    {isAuthenticated && user ? (
                        <Route element={<DashboardLayout user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}>
                            <Route path="/" element={<Navigate to={(user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_analytics) ? "/analytics" : "/requests"} replace />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/analytics" element={<ProtectedAnalyticsRoute user={user}><AnalyticsPage /></ProtectedAnalyticsRoute>} />
                            <Route path="/payroll" element={<ProtectedPayrollRoute user={user}><PlanningTable user={user} /></ProtectedPayrollRoute>} />
                            <Route path="/employees" element={<ProtectedEmployeesRoute user={user}><EmployeeTable user={user} onLogout={handleLogout} /></ProtectedEmployeesRoute>} />
                            <Route path="/employees/:id" element={<ProtectedEmployeesRoute user={user}><EmployeeViewPage /></ProtectedEmployeesRoute>} />
                            <Route path="/requests" element={<RequestsPage />} />
                            <Route path="/offers" element={<ProtectedOffersRoute user={user}><JobOffersPage /></ProtectedOffersRoute>} />
                            <Route path="/recruiting" element={<ProtectedOffersRoute user={user}><RecruitingPage /></ProtectedOffersRoute>} />
                            <Route path="/scenarios" element={<ProtectedScenariosRoute user={user}><ScenariosPage /></ProtectedScenariosRoute>} />

                            <Route path="/market" element={
                                <ProtectedMarketRoute user={user}>
                                    <MarketPage />
                                </ProtectedMarketRoute>
                            } />

                            {/* Settings Routes - Company config */}
                            <Route path="/settings" element={
                                <ProtectedSettingsRoute user={user}>
                                    <SettingsLayout />
                                </ProtectedSettingsRoute>
                            }>
                                <Route index element={<Navigate to="structure" replace />} />
                                <Route path="structure" element={<StructurePage />} />
                                <Route path="positions" element={<PositionsPage />} />
                                <Route path="offer-templates" element={<OfferTemplatesPage />} />
                                <Route path="welcome-pages" element={<WelcomePagesPage />} />
                            </Route>

                            {/* Admin Routes - System config */}
                            <Route path="/admin" element={
                                <ProtectedAdminRoute user={user}>
                                    <AdminLayout />
                                </ProtectedAdminRoute>
                            }>
                                <Route index element={<AdminDashboard />} />
                                <Route path="roles" element={<RolesPage />} />
                                <Route path="users" element={<UsersPage />} />
                                <Route path="workflow" element={<WorkflowPage />} />
                                <Route path="integrations" element={<IntegrationsPage />} />
                                <Route path="analytics-config" element={<AnalyticsSettingsPage />} />
                                <Route path="logs" element={<LogsPage />} />
                            </Route>
                        </Route>
                    ) : null}

                    {/* Catch-all: 404 for auth users, Redirect to login for guests */}
                    <Route path="*" element={
                        isAuthenticated ? <NotFoundPage /> : <Navigate to="/login" replace />
                    } />
                </Routes>
            </Suspense>
        </SnapshotProvider>
    );
}

export default App;
