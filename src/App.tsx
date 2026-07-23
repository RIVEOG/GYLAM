import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fetchSettings } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { Layout } from '@/components/Layout';
import { FullScreenSpinner } from '@/components/Spinner';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';
import { Servers } from '@/pages/Servers';
import { CreateServer } from '@/pages/CreateServer';
import { ServerDetail } from '@/pages/ServerDetail';
import { Account } from '@/pages/Account';
import { AdminUsers } from '@/pages/AdminUsers';
import { AdminNodes } from '@/pages/AdminNodes';
import { AdminServers } from '@/pages/AdminServers';
import { AdminSettings } from '@/pages/AdminSettings';

type Page =
  | 'dashboard'
  | 'servers'
  | 'create'
  | 'server-detail'
  | 'account'
  | 'admin-users'
  | 'admin-nodes'
  | 'admin-servers'
  | 'admin-settings';

type AuthPage = 'login' | 'register';

function Panel() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [authPage, setAuthPage] = useState<AuthPage>('login');
  const [openServerId, setOpenServerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (session) {
      fetchSettings().then(setSettings).catch(() => setSettings(null));
    }
  }, [session]);

  // update document title with panel name
  useEffect(() => {
    if (settings?.panel_name) {
      document.title = `${settings.panel_name} — Game Server Management`;
    }
  }, [settings?.panel_name]);

  if (loading) return <FullScreenSpinner label="Loading panel..." />;

  if (!session) {
    return authPage === 'login' ? (
      <Login onSwitch={setAuthPage} panelName={settings?.panel_name ?? 'Panel'} />
    ) : (
      <Register onSwitch={setAuthPage} panelName={settings?.panel_name ?? 'Panel'} />
    );
  }

  const openServer = (id: string) => {
    setOpenServerId(id);
    setPage('server-detail');
  };

  const navigate = (p: string) => setPage(p as Page);

  const isAdmin = profile?.is_admin;
  const adminPages: Page[] = ['admin-users', 'admin-nodes', 'admin-servers', 'admin-settings'];
  if (adminPages.includes(page) && !isAdmin) {
    setPage('dashboard');
  }

  const render = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} onOpenServer={openServer} />;
      case 'servers':
        return <Servers onNavigate={navigate} onOpenServer={openServer} />;
      case 'create':
        return <CreateServer onNavigate={navigate} onCreated={openServer} />;
      case 'server-detail':
        return openServerId ? <ServerDetail serverId={openServerId} onNavigate={navigate} /> : null;
      case 'account':
        return <Account />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-nodes':
        return <AdminNodes />;
      case 'admin-servers':
        return <AdminServers onOpenServer={openServer} />;
      case 'admin-settings':
        return <AdminSettings />;
      default:
        return <Dashboard onNavigate={navigate} onOpenServer={openServer} />;
    }
  };

  return (
    <Layout page={page} onNavigate={navigate} panelName={settings?.panel_name ?? 'Panel'}>
      {render()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Panel />
    </AuthProvider>
  );
}
