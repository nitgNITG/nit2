'use client'
import ContactRows from "../components/ContactRows";
import { useState } from "react";

const STAGES = [
    { key: '', label: 'All', color: 'bg-gray-100 text-gray-700' },
    { key: 'lead', label: 'Lead', color: 'bg-gray-200 text-gray-800' },
    { key: 'mql', label: 'MQL', color: 'bg-blue-100 text-blue-800' },
    { key: 'sql', label: 'SQL', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'opportunity', label: 'Opportunity 🔥', color: 'bg-green-100 text-green-800' },
];

const Contacts = () => {
    const [activeStage, setActiveStage] = useState('');

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Contacts & Leads</h4>
            </div>

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
