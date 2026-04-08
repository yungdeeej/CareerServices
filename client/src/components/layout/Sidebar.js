import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/students', label: 'Students', icon: '🎓' },
  { path: '/hosts', label: 'Hosts', icon: '🏢' },
  { path: '/reports', label: 'Reports', icon: '📈', adminOnly: true },
  { path: '/settings', label: 'Settings', icon: '⚙️', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-dark-card border-r border-dark-border flex flex-col">
      <div className="p-6 border-b border-dark-border">
        <h1 className="text-xl font-bold text-white">MCG Career Services</h1>
        <p className="text-sm text-gray-400 mt-1">Portal v1.0</p>
      </div>

      <nav className="flex-1 py-4">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-dark-hover text-white border-r-2 border-accent-blue'
                  : 'text-gray-400 hover:text-white hover:bg-dark-hover'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-blue flex items-center justify-center text-white text-sm font-medium">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
