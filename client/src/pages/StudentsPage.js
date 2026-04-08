import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { StatusBadge, ProgressBar } from '../components/common/StatusBadge';

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filters, setFilters] = useState({ status: '', program_id: '', campus: '', assigned_pc_id: '' });

  const fileInputRef = useRef();

  const fetchStudents = async () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const res = await api.get('/students', { params });
    setStudents(res.data);
  };

  useEffect(() => {
    Promise.all([
      api.get('/students'),
      api.get('/programs'),
      user.role === 'admin' ? api.get('/users') : Promise.resolve({ data: [] }),
    ])
      .then(([studRes, progRes, userRes]) => {
        setStudents(studRes.data);
        setPrograms(progRes.data);
        setUsers(userRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.role]);

  useEffect(() => {
    if (!loading) fetchStudents();
  }, [filters]);

  const handleImport = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/students/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      fetchStudents();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed' });
    }
  };

  const campuses = [...new Set(students.map((s) => s.campus).filter(Boolean))];

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Students</h1>
        {user.role === 'admin' && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowImport(!showImport); setShowForm(false); }}
              className="bg-dark-card border border-dark-border text-white px-4 py-2 rounded-lg text-sm hover:bg-dark-hover"
            >
              Import CSV
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setShowImport(false); }}
              className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
            >
              + Add Student
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pre_req">Pre-Req Incomplete</option>
            <option value="ready">Ready</option>
            <option value="active">Active</option>
            <option value="completing">Completing</option>
            <option value="complete">Complete</option>
          </select>
          <select
            value={filters.program_id}
            onChange={(e) => setFilters({ ...filters, program_id: e.target.value })}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select
            value={filters.campus}
            onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
            className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">All Campuses</option>
            {campuses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {user.role === 'admin' && (
            <select
              value={filters.assigned_pc_id}
              onChange={(e) => setFilters({ ...filters, assigned_pc_id: e.target.value })}
              className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">All PCs</option>
              {users.filter(u => u.role === 'pc').map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* CSV Import Panel */}
      {showImport && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
          <h3 className="text-white font-medium mb-3">Import Students from CSV</h3>
          <p className="text-xs text-gray-400 mb-3">
            Columns: campus_login_id, first_name, last_name, email, phone, program_code, campus,
            cohort_start_date, practicum_start_date, assigned_pc_email, host_id, hours_required,
            doc_first_aid (Y/N), doc_pic (Y/N), doc_immunization (Y/N), doc_resume (Y/N)
          </p>
          <div className="flex gap-3">
            <input type="file" accept=".csv" ref={fileInputRef} className="text-sm text-gray-400" />
            <button onClick={handleImport} className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm">
              Upload & Import
            </button>
          </div>
          {importResult && (
            <div className="mt-4 p-3 rounded-lg bg-dark-bg border border-dark-border text-sm">
              {importResult.error ? (
                <p className="text-red-400">{importResult.error}</p>
              ) : (
                <>
                  <p className="text-green-400">Imported: {importResult.imported} / {importResult.total}</p>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-400 font-medium">Errors:</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-red-400">Row {e.row}: {e.error}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Student Form */}
      {showForm && (
        <StudentForm
          programs={programs}
          users={users}
          onSave={() => { setShowForm(false); fetchStudents(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Student Table */}
      <div className="bg-dark-card border border-dark-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Program</th>
              <th className="px-4 py-3 font-medium">Campus</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Hours</th>
              <th className="px-4 py-3 font-medium">Host</th>
              <th className="px-4 py-3 font-medium">PC</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-dark-border/50 hover:bg-dark-hover">
                <td className="px-4 py-3">
                  <Link to={`/students/${s.id}`} className="text-white hover:text-accent-blue font-medium">
                    {s.first_name} {s.last_name}
                  </Link>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-400">{s.program_code}</td>
                <td className="px-4 py-3 text-gray-400">{s.campus || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3 w-40">
                  <ProgressBar current={parseFloat(s.hours_logged)} total={s.hours_required} />
                </td>
                <td className="px-4 py-3 text-gray-400">{s.host_name || '-'}</td>
                <td className="px-4 py-3 text-gray-400">{s.pc_name || '-'}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentForm({ programs, users, onSave, onCancel }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    program_id: '', campus: '', cohort_start_date: '', practicum_start_date: '',
    assigned_pc_id: '', hours_required: '', campus_login_id: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const program = programs.find(p => p.id === parseInt(form.program_id));
      await api.post('/students', {
        ...form,
        program_id: parseInt(form.program_id) || null,
        assigned_pc_id: parseInt(form.assigned_pc_id) || null,
        hours_required: parseInt(form.hours_required) || program?.hours_required || 0,
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create student');
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
      <h3 className="text-white font-medium mb-4">Add New Student</h3>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
        <Input label="First Name" value={form.first_name} onChange={v => setForm({...form, first_name: v})} required />
        <Input label="Last Name" value={form.last_name} onChange={v => setForm({...form, last_name: v})} required />
        <Input label="Email" type="email" value={form.email} onChange={v => setForm({...form, email: v})} required />
        <Input label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} />
        <Input label="Campus Login ID" value={form.campus_login_id} onChange={v => setForm({...form, campus_login_id: v})} />
        <div>
          <label className="block text-sm text-gray-400 mb-1">Program</label>
          <select
            value={form.program_id}
            onChange={(e) => {
              const p = programs.find(pr => pr.id === parseInt(e.target.value));
              setForm({...form, program_id: e.target.value, hours_required: p?.hours_required?.toString() || form.hours_required });
            }}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">Select Program</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <Input label="Campus" value={form.campus} onChange={v => setForm({...form, campus: v})} placeholder="Calgary, Red Deer..." />
        <Input label="Hours Required" type="number" value={form.hours_required} onChange={v => setForm({...form, hours_required: v})} required />
        <Input label="Cohort Start" type="date" value={form.cohort_start_date} onChange={v => setForm({...form, cohort_start_date: v})} />
        <Input label="Practicum Start" type="date" value={form.practicum_start_date} onChange={v => setForm({...form, practicum_start_date: v})} />
        <div>
          <label className="block text-sm text-gray-400 mb-1">Assigned PC</label>
          <select
            value={form.assigned_pc_id}
            onChange={(e) => setForm({...form, assigned_pc_id: e.target.value})}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">Select PC</option>
            {users.filter(u => u.role === 'pc' || u.role === 'admin').map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-3 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
          <button type="submit" className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600">Create Student</button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-blue"
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
