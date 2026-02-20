import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import EmployeeTable from './components/EmployeeTable';
import PlanningTable from './components/PlanningTable';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RequestsPage from './pages/RequestsPage';
import MarketPage from './pages/MarketPage';
import ScenariosPage from './pages/ScenariosPage';
import { api } from './lib/api';
import { SnapshotProvider } from './context/SnapshotContext';

// Admin SubPages
import AdminLayout from './pages/admin/AdminLayout';
import RolesPage from './pages/admin/RolesPage';
import UsersPage from './pages/admin/UsersPage';
import StructurePage from './pages/admin/StructurePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import WorkflowPage from './pages/admin/WorkflowPage';
import IntegrationsPage from './pages/admin/IntegrationsPage';
import SettingsLayout from './pages/settings/SettingsLayout';
import PositionsPage from './pages/settings/PositionsPage';

type AuthUser = {
    id: number;
    full_name: string;
    role: string;
    permissions: Record<string, boolean>;
    scope_branches?: number[];
    scope_departments?: number[];
    access_token?: string;
};

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

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Check localStorage on mount & refresh user data
    useEffect(() => {
        const initAuth = async () => {
            const storedUserRaw = localStorage.getItem('fot_user');
            if (storedUserRaw) {
                try {
                    const storedUser = JSON.parse(storedUserRaw);
                    // Set initial state from local storage for speed
                    setUser(storedUser);
                    setIsAuthenticated(true);

                    // Fetch fresh data from server
                    try {
                        const response = await api.get('/auth/me');
                        const freshUser = response.data;
                        // Merge fresh data with existing token
                        const updatedUser = { ...freshUser, access_token: storedUser.access_token };

                        setUser(updatedUser);
                        localStorage.setItem('fot_user', JSON.stringify(updatedUser));
                    } catch (err) {
                        console.error("Failed to refresh user data from server", err);
                    }

                } catch (e) {
                    console.error("Failed to parse user", e);
                    localStorage.removeItem('fot_user');
                    setUser(null);
                    setIsAuthenticated(false);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    const handleLogin = (userData: AuthUser) => {
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('fot_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        localStorage.removeItem('fot_user');
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
            <Routes>
                <Route path="/login" element={
                    !isAuthenticated ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" replace />
                } />

                {/* Protected Routes */}
                {isAuthenticated && user ? (
                    <Route element={<DashboardLayout user={user} onLogout={handleLogout} />}>
                        <Route path="/" element={<Navigate to={(user.role === 'Administrator' || user.permissions?.admin_access || user.permissions?.view_analytics) ? "/analytics" : "/requests"} replace />} />
                        <Route path="/analytics" element={<ProtectedAnalyticsRoute user={user}><AnalyticsPage /></ProtectedAnalyticsRoute>} />
                        <Route path="/payroll" element={<ProtectedPayrollRoute user={user}><PlanningTable user={user} /></ProtectedPayrollRoute>} />
                        <Route path="/employees" element={<ProtectedEmployeesRoute user={user}><EmployeeTable user={user} onLogout={handleLogout} /></ProtectedEmployeesRoute>} />
                        <Route path="/requests" element={<RequestsPage />} />
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
                        </Route>
                    </Route>
                ) : (
                    <Route path="*" element={<Navigate to="/login" replace />} />
                )}
            </Routes>
        </SnapshotProvider>
    );
}

export default App;
