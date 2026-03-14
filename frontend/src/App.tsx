import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import BoardPage from './pages/BoardPage';
import TaskPage from './pages/TaskPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import RoadmapPage from './pages/RoadmapPage';
import CreateTaskModal from './components/CreateTaskModal';

function getTabKey(path: string): string {
  if (path === '/') return '/';
  if (path === '/board' || path.startsWith('/tasks')) return '/board';
  if (path === '/roadmap') return '/roadmap';
  if (path === '/admin') return '/admin';
  return path;
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const lastPaths = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!path.startsWith('/tasks/')) {
      const key = getTabKey(path);
      lastPaths.current[key] = path;
    }
  }, [path]);

  const tabs = [
    {
      key: '/',
      defaultTo: '/',
      label: 'Панель',
      active: path === '/',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
        </svg>
      ),
    },
    {
      key: '/board',
      defaultTo: '/board',
      label: 'Задачи',
      active: path === '/board' || path.startsWith('/tasks'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: '/roadmap',
      defaultTo: '/roadmap',
      label: 'Роадмап',
      active: path === '/roadmap',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      key: '/admin',
      defaultTo: '/admin',
      label: 'Админ',
      active: path === '/admin',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleClick = (tab: typeof tabs[0]) => {
    if (tab.active) return;
    const target = lastPaths.current[tab.key] || tab.defaultTo;
    navigate(target);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleClick(tab)}
            className={`flex flex-col items-center gap-0.5 py-2 px-4 transition-colors ${
              tab.active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function FAB({ onClick }: { onClick: () => void }) {
  const location = useLocation();
  const show = location.pathname === '/' || location.pathname === '/board' || location.pathname === '/roadmap';
  if (!show) return null;

  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-24 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-all active:scale-95 safe-bottom-fab"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

export default function App() {
  const [showCreate, setShowCreate] = useState(false);

  const handleCreated = () => {
    window.dispatchEvent(new Event('taskCreated'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pb-20">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <FAB onClick={() => setShowCreate(true)} />
      <BottomNav />
      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
    </div>
  );
}
