import { Routes, Route, Link, useLocation } from 'react-router-dom';
import BoardPage from './pages/BoardPage';
import TaskPage from './pages/TaskPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
// import { subscribeToPush } from './pushSubscribe';

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    {
      to: '/',
      label: 'Задачи',
      active: path === '/' || path.startsWith('/tasks'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      to: '/dashboard',
      label: 'Панель',
      active: path === '/dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
        </svg>
      ),
    },
    {
      to: '/admin',
      label: 'Управление',
      active: path === '/admin',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center gap-0.5 py-2 px-4 transition-colors ${
              tab.active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  // useEffect(() => {
  //   const timer = setTimeout(() => subscribeToPush(), 3000);
  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pb-20">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<BoardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks/:id" element={<TaskPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
