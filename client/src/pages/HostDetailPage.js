import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { AgreementBadge, StatusBadge, ProgressBar } from '../components/common/StatusBadge';

export default function HostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [host, setHost] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const fetchHost = async () => {
    try {
      const res = await api.get(`/hosts/${id}`);
      setHost(res.data);
    } catch {
      navigate('/hosts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHost(); }, [id]);

  const handleSendAgreement = async () => {
    if (!window.confirm('Send site agreement to this host via PandaDoc?')) return;
    setSending(true);
    try {
      await api.post(`/hosts/${id}/send-agreement`);
      fetchHost();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send agreement');
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await api.put(`/hosts/${id}`, editForm);
      setHost({...res.data, students: host.students});
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update host');
    }
  };

  const programs = ['BMT', 'AMT', 'MOA', 'AT', 'GOSC'];

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;
  if (!host) return <div className="text-gray-400 p-8">Host not found</div>;

  return (
    <div>
      <Link to="/hosts" className="text-gray-400 hover:text-white text-sm">&larr; Hosts</Link>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mt-4">
          {error}
        </div>
      )}

      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mt-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{host.org_name}</h1>
            <p className="text-gray-400 text-sm mt-1">{host.address || 'No address'}</p>
          </div>
          <div className="flex items-center gap-3">
            <AgreementBadge status={host.agreement_status} />
            {user.role === 'admin' && (
              <div className="flex gap-2">
                {host.agreement_status === 'none' && (
                  <button
                    onClick={handleSendAgreement}
                    disabled={sending}
                    className="text-sm px-3 py-1.5 bg-accent-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Site Agreement'}
                  </button>
                )}
                <button
                  onClick={() => { setEditing(!editing); setEditForm(host); }}
                  className="text-sm px-3 py-1.5 bg-dark-hover border border-dark-border rounded-lg text-white"
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-border">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Organization Name</label>
              <input value={editForm.org_name || ''} onChange={e => setEditForm({...editForm, org_name: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
              <input value={editForm.contact_name || ''} onChange={e => setEditForm({...editForm, contact_name: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
              <input value={editForm.contact_email || ''} onChange={e => setEditForm({...editForm, contact_email: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone</label>
              <input value={editForm.contact_phone || ''} onChange={e => setEditForm({...editForm, contact_phone: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Campus Region</label>
              <input value={editForm.campus_region || ''} onChange={e => setEditForm({...editForm, campus_region: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Capacity</label>
              <input type="number" value={editForm.capacity || ''} onChange={e => setEditForm({...editForm, capacity: parseInt(e.target.value) || null})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs text-gray-400 mb-1">Address</label>
              <input value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs text-gray-400 mb-2">Programs Accepted</label>
              <div className="flex gap-3">
                {programs.map(p => (
                  <label key={p} className="flex items-center gap-1.5 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={(editForm.programs_accepted || []).includes(p)}
                      onChange={() => {
                        const current = editForm.programs_accepted || [];
                        setEditForm({
                          ...editForm,
                          programs_accepted: current.includes(p) ? current.filter(x => x !== p) : [...current, p],
                        });
                      }}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.is_active ?? true} onChange={e => setEditForm({...editForm, is_active: e.target.checked})} />
                Active
              </label>
              <button onClick={handleSave} className="bg-accent-green text-white px-4 py-2 rounded-lg text-sm">Save</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 text-sm">
            <InfoItem label="Contact" value={host.contact_name || '-'} />
            <InfoItem label="Email" value={host.contact_email || '-'} />
            <InfoItem label="Phone" value={host.contact_phone || '-'} />
            <InfoItem label="Region" value={host.campus_region || '-'} />
            <InfoItem label="Programs" value={host.programs_accepted?.join(', ') || '-'} />
            <InfoItem label="Capacity" value={host.capacity || '-'} />
            <InfoItem label="Active" value={host.is_active ? 'Yes' : 'No'} />
            <InfoItem label="Agreement Sent" value={host.agreement_sent_date?.split('T')[0] || '-'} />
            <InfoItem label="Agreement Executed" value={host.agreement_executed_date?.split('T')[0] || '-'} />
            <InfoItem label="Agreement Expires" value={host.agreement_expires_date?.split('T')[0] || '-'} />
            <InfoItem label="Availability Confirmed" value={host.availability_confirmed ? 'Yes' : 'No'} />
            <InfoItem label="Last Nurture Email" value={host.last_nurture_email_sent?.split('T')[0] || 'Never'} />
          </div>
        )}
      </div>

      {/* Assigned Students */}
      {host.students?.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-5 mt-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Assigned Students ({host.students.length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-dark-border">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Program</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Hours</th>
              </tr>
            </thead>
            <tbody>
              {host.students.map(s => (
                <tr key={s.id} className="border-b border-dark-border/50">
                  <td className="py-2">
                    <Link to={`/students/${s.id}`} className="text-white hover:text-accent-blue">
                      {s.first_name} {s.last_name}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-400">{s.program_code}</td>
                  <td className="py-2"><StatusBadge status={s.status} /></td>
                  <td className="py-2 w-40">
                    <ProgressBar current={parseFloat(s.hours_logged)} total={s.hours_required} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white">{value}</p>
    </div>
  );
}
