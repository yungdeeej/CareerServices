import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { StatusBadge, ProgressBar } from '../components/common/StatusBadge';
import DocChecklist from '../components/common/DocChecklist';

export default function DashboardPage() {
  const { user } = useAuth();

  return user?.role === 'admin' ? <AdminDashboard /> : <PCDashboard />;
}

function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/summary'),
      api.get('/students'),
    ])
      .then(([summaryRes, studentsRes]) => {
        setSummary(summaryRes.data);
        setStudents(studentsRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Active Students"
          value={summary?.totalActive || 0}
          color="text-accent-blue"
        />
        <SummaryCard
          title="Completion Rate (90d)"
          value={`${summary?.completionRate90Days || 0}%`}
          color="text-accent-green"
        />
        <SummaryCard
          title="Hosts w/o Agreement"
          value={summary?.hostsWithoutAgreement || 0}
          color="text-accent-red"
        />
        <SummaryCard
          title="Total Students"
          value={students.length}
          color="text-white"
        />
      </div>

      {/* Status Breakdown */}
      {summary?.byStatus && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Students by Status</h2>
          <div className="grid grid-cols-5 gap-4">
            {summary.byStatus.map((s) => (
              <div key={s.status} className="text-center">
                <StatusBadge status={s.status} />
                <p className="text-2xl font-bold text-white mt-2">{s.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Students */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">All Students</h2>
          <Link to="/students" className="text-sm text-accent-blue hover:underline">
            View All
          </Link>
        </div>
        <StudentTable students={students.slice(0, 20)} />
      </div>
    </div>
  );
}

function PCDashboard() {
  const [students, setStudents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students')
      .then((res) => {
        setStudents(res.data);
        generateAlerts(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const generateAlerts = (studs) => {
    const alertList = [];
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const s of studs) {
      // No hours this week for active students
      if (s.status === 'active') {
        alertList.push({
          type: 'warning',
          message: `${s.first_name} ${s.last_name} — active, check hours submission`,
          studentId: s.id,
        });
      }

      // Unchecked docs
      if (s.status === 'pre_req') {
        alertList.push({
          type: 'info',
          message: `${s.first_name} ${s.last_name} — has unchecked required documents`,
          studentId: s.id,
        });
      }

      // T-60 or T-30 with unbooked launch meeting
      if (s.practicum_start_date && !s.launch_meeting_booked) {
        const startDate = new Date(s.practicum_start_date);
        const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 60 && daysUntil > 0) {
          alertList.push({
            type: 'danger',
            message: `${s.first_name} ${s.last_name} — launch meeting not booked (${daysUntil} days until practicum)`,
            studentId: s.id,
          });
        }
      }

      // Completing but grading pack not sent
      if (s.status === 'completing' && !s.grading_pack_sent) {
        alertList.push({
          type: 'warning',
          message: `${s.first_name} ${s.last_name} — in completing status, grading pack not returned`,
          studentId: s.id,
        });
      }
    }

    setAlerts(alertList);
  };

  const handleDocToggle = async (studentId, docKey, value) => {
    try {
      await api.patch(`/students/${studentId}/docs`, { [docKey]: value });
      const res = await api.get('/students');
      setStudents(res.data);
      generateAlerts(res.data);
    } catch (err) {
      console.error('Doc toggle error:', err);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">My Dashboard</h1>

      {/* Alert Queue */}
      {alerts.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Alerts</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.map((alert, i) => (
              <Link
                key={i}
                to={`/students/${alert.studentId}`}
                className={`block p-2 rounded text-sm ${
                  alert.type === 'danger'
                    ? 'bg-red-500/10 text-red-400'
                    : alert.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-blue-500/10 text-blue-400'
                } hover:opacity-80`}
              >
                {alert.message}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Student List */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          My Students ({students.length})
        </h2>
        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-dark-bg border border-dark-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Link
                  to={`/students/${student.id}`}
                  className="text-white font-medium hover:text-accent-blue"
                >
                  {student.first_name} {student.last_name}
                </Link>
                <StatusBadge status={student.status} />
              </div>
              <div className="text-xs text-gray-400 mb-2">
                {student.program_code} | {student.campus || 'N/A'}
                {student.host_name && ` | ${student.host_name}`}
              </div>
              <ProgressBar
                current={parseFloat(student.hours_logged)}
                total={student.hours_required}
              />
              <div className="mt-2">
                <DocChecklist
                  student={student}
                  programCode={student.program_code}
                  onToggle={(key, val) => handleDocToggle(student.id, key, val)}
                />
              </div>
            </div>
          ))}
          {students.length === 0 && (
            <p className="text-gray-400 text-center py-8">No students assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function StudentTable({ students }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-dark-border">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Program</th>
            <th className="pb-2 font-medium">Campus</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Hours</th>
            <th className="pb-2 font-medium">PC</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-dark-border/50 hover:bg-dark-hover">
              <td className="py-2.5">
                <Link to={`/students/${s.id}`} className="text-white hover:text-accent-blue">
                  {s.first_name} {s.last_name}
                </Link>
              </td>
              <td className="py-2.5 text-gray-400">{s.program_code}</td>
              <td className="py-2.5 text-gray-400">{s.campus || '-'}</td>
              <td className="py-2.5"><StatusBadge status={s.status} /></td>
              <td className="py-2.5 w-48">
                <ProgressBar current={parseFloat(s.hours_logged)} total={s.hours_required} />
              </td>
              <td className="py-2.5 text-gray-400">{s.pc_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}
