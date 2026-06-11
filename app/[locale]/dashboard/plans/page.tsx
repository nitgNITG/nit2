'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const SERVICE_OPTIONS = [
    { value: 'moodle',    label: 'Moodle LMS' },
    { value: 'ecommerce', label: 'eCommerce' },
    { value: 'mobile',    label: 'Mobile App' },
];

const EMPTY_FORM = {
    service: 'moodle',
    nameAr: '',
    nameEn: '',
    price: '',
    currency: 'USD',
    featuresAr: '',
    featuresEn: '',
    isActive: true,
    order: '0',
};

const PlansPage = () => {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editId, setEditId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const fetchPlans = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/plans');
            setPlans(data.plans ?? []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    const openAdd = () => {
        setForm({ ...EMPTY_FORM });
        setEditId(null);
        setShowForm(true);
    };

    const openEdit = (plan: any) => {
        setForm({
            service: plan.service,
            nameAr: plan.nameAr,
            nameEn: plan.nameEn,
            price: String(plan.price),
            currency: plan.currency,
            featuresAr: plan.featuresAr?.join('\n') ?? '',
            featuresEn: plan.featuresEn?.join('\n') ?? '',
            isActive: plan.isActive,
            order: String(plan.order ?? 0),
        });
        setEditId(plan.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                ...form,
                price: Number(form.price),
                order: Number(form.order),
                featuresAr: form.featuresAr.split('\n').map(s => s.trim()).filter(Boolean),
                featuresEn: form.featuresEn.split('\n').map(s => s.trim()).filter(Boolean),
            };
            if (editId) {
                await axios.put(`/api/plans/${editId}`, payload);
                toast.success('Plan updated');
            } else {
                await axios.post('/api/plans', payload);
                toast.success('Plan created');
            }
            setShowForm(false);
            fetchPlans();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this plan?')) return;
        try {
            await axios.delete(`/api/plans/${id}`);
            toast.success('Deleted');
            setPlans(prev => prev.filter(p => p.id !== id));
        } catch {
            toast.error('Error deleting');
        }
    };

    const toggleActive = async (plan: any) => {
        try {
            await axios.put(`/api/plans/${plan.id}`, { isActive: !plan.isActive });
            setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p));
        } catch { toast.error('Error'); }
    };

    const grouped = SERVICE_OPTIONS.map(s => ({
        ...s,
        items: plans.filter(p => p.service === s.value).sort((a, b) => a.order - b.order),
    }));

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div className='flex justify-between items-center'>
                <div>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>💰 Plans & Pricing</h4>
                    <p className='text-sm text-gray-500 mt-1'>Manage the "Starting From" prices shown on service pages</p>
                </div>
                <button onClick={openAdd}
                    className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-5 py-2 rounded-md'>
                    + Add Plan
                </button>
            </div>

            {/* Add / Edit Form */}
            {showForm && (
                <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4'>
                    <h5 className='font-bold text-lg'>{editId ? 'Edit Plan' : 'New Plan'}</h5>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Service</label>
                                <select className='w-full border rounded-lg px-3 py-2'
                                    value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
                                    {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Price (Starting From)</label>
                                <input className='w-full border rounded-lg px-3 py-2' type='number' min='0'
                                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
                            </div>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Currency</label>
                                <select className='w-full border rounded-lg px-3 py-2'
                                    value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                                    <option value='USD'>USD $</option>
                                    <option value='EGP'>EGP ج.م</option>
                                    <option value='SAR'>SAR ر.س</option>
                                    <option value='AED'>AED د.إ</option>
                                </select>
                            </div>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Plan Name (Arabic)</label>
                                <input className='w-full border rounded-lg px-3 py-2 text-right' dir='rtl'
                                    value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} required />
                            </div>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Plan Name (English)</label>
                                <input className='w-full border rounded-lg px-3 py-2'
                                    value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} required />
                            </div>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Features Arabic (one per line)</label>
                                <textarea className='w-full border rounded-lg px-3 py-2 h-28 resize-none text-right' dir='rtl'
                                    value={form.featuresAr} onChange={e => setForm(f => ({ ...f, featuresAr: e.target.value }))}
                                    placeholder='دعم عربي RTL&#10;تطبيق جوال&#10;إشعارات فورية' />
                            </div>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Features English (one per line)</label>
                                <textarea className='w-full border rounded-lg px-3 py-2 h-28 resize-none'
                                    value={form.featuresEn} onChange={e => setForm(f => ({ ...f, featuresEn: e.target.value }))}
                                    placeholder='Arabic RTL Support&#10;Mobile App&#10;Push Notifications' />
                            </div>
                        </div>

                        <div className='flex items-center gap-6'>
                            <div>
                                <label className='block text-sm font-semibold mb-1'>Display Order</label>
                                <input className='w-24 border rounded-lg px-3 py-2' type='number' min='0'
                                    value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} />
                            </div>
                            <div className='flex items-center gap-2 pt-5'>
                                <input type='checkbox' id='isActive' checked={form.isActive}
                                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                                <label htmlFor='isActive' className='text-sm font-semibold'>Active (visible on site)</label>
                            </div>
                        </div>

                        <div className='flex gap-3 pt-2'>
                            <button type='submit' disabled={loading}
                                className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-6 py-2 rounded-md'>
                                {loading ? 'Saving…' : editId ? 'Update Plan' : 'Create Plan'}
                            </button>
                            <button type='button' onClick={() => setShowForm(false)}
                                className='border border-gray-300 px-6 py-2 rounded-md text-gray-600 hover:bg-gray-50'>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Plans grouped by service */}
            {grouped.map(group => (
                <div key={group.value}>
                    <h5 className='font-bold text-sm uppercase tracking-wider text-gray-400 mb-3'>{group.label}</h5>
                    {group.items.length === 0 ? (
                        <p className='text-sm text-gray-400 bg-white rounded-xl border p-4'>No plans yet for {group.label}</p>
                    ) : (
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {group.items.map(plan => (
                                <div key={plan.id}
                                    className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 ${!plan.isActive ? 'opacity-50' : ''}`}>
                                    <div className='flex justify-between items-start'>
                                        <div>
                                            <p className='font-bold text-lg'>{plan.nameAr}</p>
                                            <p className='text-sm text-gray-500'>{plan.nameEn}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {plan.isActive ? 'Active' : 'Hidden'}
                                        </span>
                                    </div>
                                    <div className='text-2xl font-bold text-[#268F79]'>
                                        {plan.price.toLocaleString()} <span className='text-sm font-normal text-gray-500'>{plan.currency}</span>
                                        <span className='text-xs font-normal text-gray-400 mr-1'>يبدأ من</span>
                                    </div>
                                    {plan.featuresAr?.length > 0 && (
                                        <ul className='text-sm text-gray-600 space-y-1 text-right' dir='rtl'>
                                            {plan.featuresAr.map((f: string, i: number) => (
                                                <li key={i} className='flex items-center gap-2 justify-end'>
                                                    <span>{f}</span>
                                                    <span className='text-[#268F79]'>✓</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className='flex gap-2 pt-2 border-t'>
                                        <button onClick={() => openEdit(plan)}
                                            className='flex-1 text-sm border rounded-lg py-1.5 hover:bg-gray-50'>Edit</button>
                                        <button onClick={() => toggleActive(plan)}
                                            className='flex-1 text-sm border rounded-lg py-1.5 hover:bg-gray-50'>
                                            {plan.isActive ? 'Hide' : 'Show'}
                                        </button>
                                        <button onClick={() => handleDelete(plan.id)}
                                            className='text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 text-sm hover:bg-red-50'>
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default PlansPage;
