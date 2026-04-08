import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { StatusBadge, ProgressBar } from '../components/common/StatusBadge';
import DocChecklist from '../components/common/DocChecklist';

export default function StudentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [hours, setHours] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [hourForm, setHourForm] = useState({ week_ending_date: '', hours_submitted: '', supervisor_name: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [studentRes, hoursRes, hostsRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/hours`),
        api.get('/hosts'),
      ]);
      setStudent(studentRes.data);
      setHours(hoursRes.data);
      setHosts(hostsRes.data);

      if (user.role === 'admin') {
        const usersRes = await api.get('/users');
        setUsers(usersRes.data);
      }
    } catch {
      navigate('/students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleDocToggle = async (docKey, value) => {
    try {
      const res = await api.patch(`/students/${id}/docs`, { [docKey]: value });
      setStudent(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error('Doc toggle error:', err);
    }
  };

  const handleLogHours = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/students/${id}/hours`, {
        ...hourForm,
        hours_submitted: parseFloat(hourForm.hours_submitted),
      });
      setHourForm({ week_ending_date: '', hours_submitted: '', supervisor_name: '', notes: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log hours');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const res = await api.put(`/students/${id}`, editForm);
      setStudent(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update student');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      navigate('/students');
    } catch (err) {
      setError('Failed to delete student');
    }
  };

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;
  if (!student) return <div className="text-gray-400 p-8">Student not found</div>;

  const executedHosts = hosts.filter(h => h.agreement_status === 'executed');

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link to="/students" className="text-gray-400 hover:text-white text-sm">&larr; Students</Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-gray-400 text-sm">{student.email} | {student.phone || 'No phone'}</p>
            {student.campus_login_id && (
              <p className="text-gray-500 text-xs mt-1">Campus Login: {student.campus_login_id}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={student.status} />
            {user.role === 'admin' && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(!editing); setEditForm(student); }}
                  className="text-sm px-3 py-1.5 bg-dark-hover border border-dark-border rounded-lg text-white hover:bg-dark-border"
                >
                  {editing ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={handleDelete} className="text-sm px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20">
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-dark-border">
            <EditField label="First Name" value={editForm.first_name} onChange={v => setEditForm({...editForm, first_name: v})} />
            <EditField label="Last Name" value={editForm.last_name} onChange={v => setEditForm({...editForm, last_name: v})} />
            <EditField label="Email" value={editForm.email} onChange={v => setEditForm({...editForm, email: v})} />
            <EditField label="Phone" value={editForm.phone || ''} onChange={v => setEditForm({...editForm, phone: v})} />
            <EditField label="Campus" value={editForm.campus || ''} onChange={v => setEditForm({...editForm, campus: v})} />
            <div>
              <label className="block text-xs text-gray-400 mb-1">Host (executed agreements only)</label>
              <select
                value={editForm.host_id || ''}
                onChange={e => setEditForm({...editForm, host_id: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">No Host</option>
                {executedHosts.map(h => <option key={h.id} value={h.id}>{h.org_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Assigned PC</label>
              <select
                value={editForm.assigned_pc_id || ''}
                onChange={e => setEditForm({...editForm, assigned_pc_id: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">None</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
            </div>
            <EditField label="Practicum Start" type="date" value={editForm.practicum_start_date?.split('T')[0] || ''} onChange={v => setEditForm({...editForm, practicum_start_date: v})} />
            <EditField label="Practicum End" type="date" value={editForm.practicum_end_date?.split('T')[0] || ''} onChange={v => setEditForm({...editForm, practicum_end_date: v})} />
            <div className="col-span-3 flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.launch_meeting_booked || false} onChange={e => setEditForm({...editForm, launch_meeting_booked: e.target.checked})} /> Launch Meeting Booked
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.grading_pack_sent || false} onChange={e => setEditForm({...editForm, grading_pack_sent: e.target.checked})} /> Grading Pack Sent
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.timesheet_uploaded || false} onChange={e => setEditForm({...editForm, timesheet_uploaded: e.target.checked})} /> Timesheet Uploaded
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.final_eval_uploaded || false} onChange={e => setEditForm({...editForm, final_eval_uploaded: e.target.checked})} /> Final Eval Uploaded
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.exit_survey_submitted || false} onChange={e => setEditForm({...editForm, exit_survey_submitted: e.target.checked})} /> Exit Survey Submitted
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editForm.grade_released || false} onChange={e => setEditForm({...editForm, grade_released: e.target.checked})} /> Grade Released
              </label>
            </div>
            <div className="col-span-3 flex justify-end">
              <button onClick={handleSaveEdit} className="bg-accent-green text-white px-4 py-2 rounded-lg text-sm">Save Changes</button>
            </div>
          </div>
        )}

        {/* Student Info Grid */}
        {!editing && (
          <div className="grid grid-cols-4 gap-4 text-sm">
            <InfoItem label="Program" value={`${student.program_code} — ${student.program_name}`} />
            <InfoItem label="Campus" value={student.campus || '-'} />
            <InfoItem label="Host" value={student.host_name || 'Not assigned'} />
            <InfoItem label="PC" value={student.pc_name || 'Not assigned'} />
            <InfoItem label="Cohort Start" value={student.cohort_start_date?.split('T')[0] || '-'} />
            <InfoItem label="Practicum Start" value={student.practicum_start_date?.split('T')[0] || '-'} />
            <InfoItem label="Practicum End" value={student.practicum_end_date?.split('T')[0] || '-'} />
            <InfoItem label="Launch Meeting" value={student.launch_meeting_booked ? 'Booked' : 'Not booked'} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Documents */}
        <div className="bg-dark-card border border-dark-border rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Document Checklist</h2>
          <DocChecklist
            student={student}
            programCode={student.program_code}
            onToggle={handleDocToggle}
          />
        </div>

        {/* Hours Progress */}
        <div className="bg-dark-card border border-dark-border rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Hours Progress</h2>
          <ProgressBar current={parseFloat(student.hours_logged)} total={student.hours_required} />
          <p className="text-sm text-gray-400 mt-2">
            {parseFloat(student.hours_logged)} of {student.hours_required} hours completed
          </p>

          {/* Completion Checklist */}
          <div className="mt-4 pt-4 border-t border-dark-border space-y-2 text-sm">
            <CheckItem label="Grading Pack Sent" checked={student.grading_pack_sent} />
            <CheckItem label="Timesheet Uploaded" checked={student.timesheet_uploaded} />
            <CheckItem label="Final Evaluation" checked={student.final_eval_uploaded} />
            <CheckItem label="Exit Survey" checked={student.exit_survey_submitted} />
            <CheckItem label="Grade Released" checked={student.grade_released} />
          </div>
        </div>
      </div>

      {/* Hours Log */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Hours Log</h2>

        {/* Log Hours Form */}
        <form onSubmit={handleLogHours} className="grid grid-cols-5 gap-3 mb-4">
          <input
            type="date"
            value={hourForm.week_ending_date}
            onChange={e => setHourForm({...hourForm, week_ending_date: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Week ending"
            required
          />
          <input
            type="number"
            step="0.25"
            value={hourForm.hours_submitted}
            onChange={e => setHourForm({...hourForm, hours_submitted: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Hours"
            required
          />
          <input
            type="text"
            value={hourForm.supervisor_name}
            onChange={e => setHourForm({...hourForm, supervisor_name: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Supervisor name"
          />
          <input
            type="text"
            value={hourForm.notes}
            onChange={e => setHourForm({...hourForm, notes: e.target.value})}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Notes"
          />
          <button type="submit" className="bg-accent-blue text-white rounded-lg text-sm hover:bg-blue-600">
            Log Hours
          </button>
        </form>

        {/* Hours Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Week Ending</th>
              <th className="pb-2 font-medium">Hours</th>
              <th className="pb-2 font-medium">Supervisor</th>
              <th className="pb-2 font-medium">Notes</th>
              <th className="pb-2 font-medium">Approved By</th>
            </tr>
          </thead>
          <tbody>
            {hours.map(h => (
              <tr key={h.id} className="border-b border-dark-border/50">
                <td className="py-2 text-white">{h.week_ending_date?.split('T')[0]}</td>
                <td className="py-2 text-white">{h.hours_submitted}</td>
                <td className="py-2 text-gray-400">{h.supervisor_name || '-'}</td>
                <td className="py-2 text-gray-400">{h.notes || '-'}</td>
                <td className="py-2 text-gray-400">{h.approved_by_name || '-'}</td>
              </tr>
            ))}
            {hours.length === 0 && (
              <tr><td colSpan="5" className="py-4 text-center text-gray-400">No hours logged yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
      />
    </div>
  );
}

function CheckItem({ label, checked }) {
  return (
    <div className={`flex items-center gap-2 ${checked ? 'text-green-400' : 'text-gray-500'}`}>
      {checked ? '✅' : '⬜'} {label}
    </div>
  );
}
