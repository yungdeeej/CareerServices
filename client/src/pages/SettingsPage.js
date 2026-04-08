import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [usersRes, configRes, templatesRes, programsRes] = await Promise.all([
        api.get('/users'),
        api.get('/settings/config'),
        api.get('/settings/email-templates'),
        api.get('/programs'),
      ]);
      setUsers(usersRes.data);
      setConfig(configRes.data);
      setEmailTemplates(templatesRes.data);
      setPrograms(programsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Integration Status */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Integration Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-400">Integration Mode</span>
            <span className={config?.integrationMode === 'live' ? 'text-green-400' : 'text-amber-400'}>
              {config?.integrationMode?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-400">SendGrid</span>
            <span className={config?.sendgridConfigured ? 'text-green-400' : 'text-red-400'}>
              {config?.sendgridConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-400">PandaDoc</span>
            <span className={config?.pandadocConfigured ? 'text-green-400' : 'text-red-400'}>
              {config?.pandadocConfigured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-400">From Email</span>
            <span className="text-white">{config?.sendgridFromEmail || '-'}</span>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">User Management</h2>
          <button
            onClick={() => setShowUserForm(!showUserForm)}
            className="bg-accent-blue text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + Add User
          </button>
        </div>

        {showUserForm && (
          <UserForm onSave={() => { setShowUserForm(false); fetchData(); }} onCancel={() => setShowUserForm(false)} />
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <UserRow key={u.id} user={u} onUpdate={fetchData} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Programs */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Programs (Read-Only)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Code</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Hours Required</th>
              <th className="pb-2 font-medium">Required Documents</th>
            </tr>
          </thead>
          <tbody>
            {programs.map(p => (
              <tr key={p.id} className="border-b border-dark-border/50">
                <td className="py-2 text-white font-medium">{p.code}</td>
                <td className="py-2 text-gray-400">{p.name}</td>
                <td className="py-2 text-white">{p.hours_required} hrs</td>
                <td className="py-2 text-gray-400">
                  {['BMT', 'AMT', 'MOA'].includes(p.code)
                    ? 'First Aid, PIC, Immunization, Resume'
                    : 'Resume only'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Email Templates */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Email Templates</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Trigger</th>
              <th className="pb-2 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {emailTemplates.map(t => (
              <tr key={t.trigger_type} className="border-b border-dark-border/50">
                <td className="py-2 text-white">{t.trigger_type}</td>
                <td className="py-2 text-gray-400">{t.subject}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'pc' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3 mb-4 p-3 bg-dark-bg rounded-lg">
      {error && <p className="col-span-4 text-red-400 text-sm">{error}</p>}
      <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
        placeholder="Full Name" required
        className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
        placeholder="Email" required
        className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
      <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
        placeholder="Password" required
        className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
      <div className="flex gap-2">
        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
          className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-white text-sm flex-1">
          <option value="pc">PC</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="bg-accent-green text-white px-3 rounded-lg text-sm">Add</button>
        <button type="button" onClick={onCancel} className="text-gray-400 px-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function UserRow({ user, onUpdate }) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate ${user.full_name}?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) return;
    try {
      await api.put(`/users/${user.id}`, { ...user, password: newPassword });
      setResetting(false);
      setNewPassword('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <tr className="border-b border-dark-border/50">
      <td className="py-2 text-white">{user.full_name}</td>
      <td className="py-2 text-gray-400">{user.email}</td>
      <td className="py-2">
        <span className={`capitalize ${user.role === 'admin' ? 'text-accent-blue' : 'text-gray-400'}`}>
          {user.role}
        </span>
      </td>
      <td className="py-2">
        <span className={user.is_active ? 'text-green-400' : 'text-red-400'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="py-2">
        <div className="flex gap-2">
          {resetting ? (
            <>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-white text-xs w-32"
              />
              <button onClick={handleResetPassword} className="text-green-400 text-xs">Save</button>
              <button onClick={() => setResetting(false)} className="text-gray-400 text-xs">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setResetting(true)} className="text-accent-blue text-xs hover:underline">
                Reset Password
              </button>
              {user.is_active && (
                <button onClick={handleDeactivate} className="text-red-400 text-xs hover:underline">
                  Deactivate
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
