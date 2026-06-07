'use client'
import ContactRows from "../components/ContactRows";
import { useState, useEffect } from "react";
import axios from "axios";

const STAGES = [
    { key: '', label: 'All', color: 'bg-gray-100 text-gray-700' },
    { key: 'lead', label: 'Lead', color: 'bg-gray-200 text-gray-800' },
    { key: 'mql', label: 'MQL', color: 'bg-blue-100 text-blue-800' },
    { key: 'sql', label: 'SQL', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'opportunity', label: 'Opportunity 🔥', color: 'bg-green-100 text-green-800' },
];

function ServiceBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-semibold w-24 shrink-0">{label}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
            </div>
            <span className="text-xs font-bold w-10 text-right">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
        </div>
    );
}

const Contacts = () => {
    const [activeStage, setActiveStage] = useState('');
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        axios.get('/api/contact?summary=1').then(r => setSummary(r.data)).catch(() => {});
    }, []);

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Contacts & Leads</h4>
            </div>

            {/* Service interest analytics */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Funnel */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <h5 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-wider">Lead Funnel</h5>
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                                { label: 'Lead', value: summary.lead, color: 'bg-gray-200 text-gray-700' },
                                { label: 'MQL', value: summary.mql, color: 'bg-blue-100 text-blue-700' },
                                { label: 'SQL', value: summary.sql, color: 'bg-yellow-100 text-yellow-700' },
                                { label: '🔥 Opps', value: summary.opportunity, color: 'bg-green-100 text-green-700' },
                            ].map(s => (
                                <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
                                    <div className="text-2xl font-bold">{s.value}</div>
                                    <div className="text-xs font-semibold mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Service breakdown */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <h5 className="text-xs font-bold uppercase text-gray-400 mb-4 tracking-wider">Service Interest</h5>
                        {(() => {
                            const s = summary.services ?? {};
                            const total = (s.moodle ?? 0) + (s.ecommerce ?? 0) + (s.custom ?? 0) + (s.other ?? 0);
                            return (
                                <div className="space-y-3">
                                    <ServiceBar label="Moodle LMS" count={s.moodle ?? 0} total={total} color="bg-emerald-500" />
                                    <ServiceBar label="eCommerce" count={s.ecommerce ?? 0} total={total} color="bg-blue-500" />
                                    <ServiceBar label="Custom Dev" count={s.custom ?? 0} total={total} color="bg-purple-400" />
                                    <ServiceBar label="Other" count={s.other ?? 0} total={total} color="bg-gray-400" />
                                    <p className="text-xs text-gray-400 pt-1">* Only contacts who selected a service</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Stage filter tabs */}
            <div className='flex flex-wrap gap-2'>
                {STAGES.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setActiveStage(s.key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all
                            ${activeStage === s.key
                                ? 'border-[#268F79] ring-2 ring-[#268F79]/30 ' + s.color
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className='overflow-auto bg-white rounded-xl shadow-sm border border-gray-100'>
                <table className="w-full text-sm text-left rtl:text-right text-gray-600 min-w-[900px]">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Stage</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email / Phone</th>
                            <th className="px-4 py-3">Service</th>
                            <th className="px-4 py-3">Budget</th>
                            <th className="px-4 py-3">Timeline</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Pain / Message</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <ContactRows stageFilter={activeStage} />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Contacts;
