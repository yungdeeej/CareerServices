import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function ReportsPage() {
  const [completionRates, setCompletionRates] = useState(null);
  const [bottlenecks, setBottlenecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/completion-rates'),
      api.get('/reports/doc-bottlenecks'),
    ])
      .then(([ratesRes, bottleneckRes]) => {
        setCompletionRates(ratesRes.data);
        setBottlenecks(bottleneckRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Reports</h1>

      {/* Completion Rates by Program */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Completion Rates by Program</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Program</th>
              <th className="pb-2 font-medium">Total</th>
              <th className="pb-2 font-medium">Completed</th>
              <th className="pb-2 font-medium">Rate</th>
              <th className="pb-2 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {completionRates?.byProgram?.map(p => (
              <tr key={p.code} className="border-b border-dark-border/50">
                <td className="py-3 text-white">{p.code} — {p.name}</td>
                <td className="py-3 text-gray-400">{p.total}</td>
                <td className="py-3 text-green-400">{p.completed}</td>
                <td className="py-3 text-white">{p.rate}%</td>
                <td className="py-3 w-40">
                  <div className="bg-dark-border rounded-full h-2">
                    <div className="bg-accent-green h-2 rounded-full" style={{ width: `${p.rate}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {(!completionRates?.byProgram || completionRates.byProgram.length === 0) && (
              <tr><td colSpan="5" className="py-4 text-center text-gray-400">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Completion Rates by PC */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Completion Rates by PC</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Practicum Coordinator</th>
              <th className="pb-2 font-medium">Total</th>
              <th className="pb-2 font-medium">Completed</th>
              <th className="pb-2 font-medium">Rate</th>
              <th className="pb-2 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {completionRates?.byPC?.map(pc => (
              <tr key={pc.pc_name} className="border-b border-dark-border/50">
                <td className="py-3 text-white">{pc.pc_name}</td>
                <td className="py-3 text-gray-400">{pc.total}</td>
                <td className="py-3 text-green-400">{pc.completed}</td>
                <td className="py-3 text-white">{pc.rate}%</td>
                <td className="py-3 w-40">
                  <div className="bg-dark-border rounded-full h-2">
                    <div className="bg-accent-blue h-2 rounded-full" style={{ width: `${pc.rate}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {(!completionRates?.byPC || completionRates.byPC.length === 0) && (
              <tr><td colSpan="5" className="py-4 text-center text-gray-400">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Average Days */}
      {completionRates?.averageDays?.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Average Timeline (Days)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-dark-border">
                <th className="pb-2 font-medium">Program</th>
                <th className="pb-2 font-medium">Avg Days to Practicum Start</th>
                <th className="pb-2 font-medium">Avg Days to Complete Hours</th>
              </tr>
            </thead>
            <tbody>
              {completionRates.averageDays.map(d => (
                <tr key={d.code} className="border-b border-dark-border/50">
                  <td className="py-3 text-white">{d.code}</td>
                  <td className="py-3 text-gray-400">{d.avg_days_to_start ?? '-'}</td>
                  <td className="py-3 text-gray-400">{d.avg_days_to_complete ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Bottlenecks */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Document Bottlenecks (Pre-Req Students)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-dark-border">
              <th className="pb-2 font-medium">Program</th>
              <th className="pb-2 font-medium">Students</th>
              <th className="pb-2 font-medium">Missing First Aid</th>
              <th className="pb-2 font-medium">Missing PIC</th>
              <th className="pb-2 font-medium">Missing Immunization</th>
              <th className="pb-2 font-medium">Missing Resume</th>
            </tr>
          </thead>
          <tbody>
            {bottlenecks.map(b => (
              <tr key={b.program_code} className="border-b border-dark-border/50">
                <td className="py-3 text-white">{b.program_code}</td>
                <td className="py-3 text-gray-400">{b.total_students}</td>
                <td className="py-3">
                  <span className={parseInt(b.missing_first_aid) > 0 ? 'text-red-400' : 'text-gray-500'}>
                    {b.missing_first_aid}
                  </span>
                </td>
                <td className="py-3">
                  <span className={parseInt(b.missing_pic) > 0 ? 'text-red-400' : 'text-gray-500'}>
                    {b.missing_pic}
                  </span>
                </td>
                <td className="py-3">
                  <span className={parseInt(b.missing_immunization) > 0 ? 'text-red-400' : 'text-gray-500'}>
                    {b.missing_immunization}
                  </span>
                </td>
                <td className="py-3">
                  <span className={parseInt(b.missing_resume) > 0 ? 'text-red-400' : 'text-gray-500'}>
                    {b.missing_resume}
                  </span>
                </td>
              </tr>
            ))}
            {bottlenecks.length === 0 && (
              <tr><td colSpan="6" className="py-4 text-center text-gray-400">No pre-req students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
