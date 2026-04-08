import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { AgreementBadge } from '../components/common/StatusBadge';

export default function HostsPage() {
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ campus_region: '', agreement_status: '', program: '' });

  const fetchHosts = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const res = await api.get('/hosts', { params });
    setHosts(res.data);
  };

  useEffect(() => {
    fetchHosts().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) fetchHosts();
  }, [filters]);

  const regions = [...new Set(hosts.map(h => h.campus_region).filter(Boolean))];

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Host Sites</h1>
        {user.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
          >
            + Add Host
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.campus_region}
            onChange={e => setFilters({...filters, campus_region: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filters.agreement_status}
            onChange={e => setFilters({...filters, agreement_status: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Agreement Statuses</option>
            <option value="none">No Agreement</option>
            <option value="sent">Sent</option>
            <option value="host_signed">Host Signed</option>
            <option value="executed">Executed</option>
          </select>
          <select
            value={filters.program}
            onChange={e => setFilters({...filters, program: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Programs</option>
            <option value="BMT">BMT</option>
            <option value="AMT">AMT</option>
            <option value="MOA">MOA</option>
            <option value="AT">AT</option>
            <option value="GOSC">GOSC</option>
          </select>
        </div>
      </div>

      {showForm && (
        <HostForm
          onSave={() => { setShowForm(false); fetchHosts(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Host Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hosts.map(host => (
          <Link
            key={host.id}
            to={`/hosts/${host.id}`}
            className="bg-dark-card border border-dark-border rounded-lg p-5 hover:bg-dark-hover transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-white font-medium">{host.org_name}</h3>
              <AgreementBadge status={host.agreement_status} />
            </div>
            <div className="space-y-1 text-sm text-gray-400">
              {host.contact_name && <p>{host.contact_name}</p>}
              {host.contact_email && <p>{host.contact_email}</p>}
              {host.campus_region && <p>Region: {host.campus_region}</p>}
              {host.programs_accepted?.length > 0 && (
                <p>Programs: {host.programs_accepted.join(', ')}</p>
              )}
              {host.capacity && <p>Capacity: {host.capacity}</p>}
            </div>
          </Link>
        ))}
        {hosts.length === 0 && (
          <div className="col-span-3 text-center py-8 text-gray-400">No hosts found</div>
        )}
      </div>
    </div>
  );
}

function HostForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    org_name: '', contact_name: '', contact_email: '', contact_phone: '',
    address: '', campus_region: '', programs_accepted: [], capacity: '',
  });
  const [error, setError] = useState('');

  const programs = ['BMT', 'AMT', 'MOA', 'AT', 'GOSC'];

  const toggleProgram = (code) => {
    setForm(prev => ({
      ...prev,
      programs_accepted: prev.programs_accepted.includes(code)
        ? prev.programs_accepted.filter(p => p !== code)
        : [...prev.programs_accepted, code],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hosts', {
        ...form,
        capacity: form.capacity ? parseInt(form.capacity) : null,
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create host');
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
      <h3 className="text-white font-medium mb-4">Add New Host</h3>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Organization Name *</label>
          <input value={form.org_name} onChange={e => setForm({...form, org_name: e.target.value})} required
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Name</label>
          <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
          <input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Campus Region</label>
          <input value={form.campus_region} onChange={e => setForm({...form, campus_region: e.target.value})}
            placeholder="Calgary, Red Deer, etc."
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Capacity</label>
          <input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
        </div>
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-2">Programs Accepted</label>
          <div className="flex gap-3">
            {programs.map(p => (
              <label key={p} className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.programs_accepted.includes(p)}
                  onChange={() => toggleProgram(p)}
                  className="rounded border-dark-border"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-3 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
          <button type="submit" className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600">Create Host</button>
        </div>
      </form>
    </div>
  );
}
