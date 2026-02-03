"use client";
import React, { useState } from 'react';
import { useApp } from '@/lib/store';
import { Building2, Save, Users, UserPlus, Shield, Mail, Phone, Ban, History, AlertTriangle } from 'lucide-react';
import { Role, User, BanRecord, BanScope } from '@/lib/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const { business, users, addUser, currentUser, bans = [], addBan, venues } = useApp();
    const [activeTab, setActiveTab] = useState<'business' | 'users' | 'profile'>('business');

    // Delete Self State
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');

    const handleDeleteAccount = async () => {
        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
                body: JSON.stringify({ action: 'DELETE_ACCOUNT', payload: { id: currentUser?.id } })
            });
            window.location.href = '/login';
        } catch (e) {
            console.error("Failed to delete account", e);
        }
    };

    // Ban Modal State
    const [showBanModal, setShowBanModal] = useState(false);
    const [selectedUserToBan, setSelectedUserToBan] = useState<User | null>(null);
    const [banScope, setBanScope] = useState<BanScope>('BUSINESS');
    const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
    const [banDuration, setBanDuration] = useState<'PERMANENT' | 'TEMPORARY'>('PERMANENT');
    const [banEndDate, setBanEndDate] = useState('');
    const [banReasonCat, setBanReasonCat] = useState('Policy Violation');
    const [banReasonText, setBanReasonText] = useState('');
    // Ban Confirmation State
    const [banConfirmText, setBanConfirmText] = useState('');

    // Remove User State
    const [showRemoveUserModal, setShowRemoveUserModal] = useState(false);
    const [userToRemove, setUserToRemove] = useState<User | null>(null);

    const handleRemoveUser = async () => {
        if (!userToRemove) return;
        // API call to remove user would go here. 
        // For now we rely on the store's action if exists, or just calling the API directly
        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser?.id || '' },
                body: JSON.stringify({ action: 'REMOVE_USER', payload: { id: userToRemove.id } })
            });
            // Force reload or optimistically update? 
            // The store might not update automatically if we don't use the hook action.
            // But `users` from `useApp` updates via SWR/polling usually.
            // Let's assume eventual consistency or refresh.
            window.location.reload(); // Simple brute force update for now
        } catch (e) {
            console.error("Failed to remove user", e);
        }
        setShowRemoveUserModal(false);
        setUserToRemove(null);
    };

    const handleOpenBanModal = (user: User) => {
        setSelectedUserToBan(user);
        setBanScope('BUSINESS');
        setSelectedVenueIds([]);
        setBanDuration('PERMANENT');
        setBanReasonCat('Policy Violation');
        setBanReasonText('');
        setBanConfirmText('');
        setShowBanModal(true);
    };

    const handleConfirmBan = async () => {
        if (!selectedUserToBan || !currentUser || !business) return;

        const newBan: BanRecord = {
            id: Math.random().toString(36).substring(7),
            org_id: business.id,
            user_id: selectedUserToBan.id,
            scope_type: banScope,
            scope_venue_ids: banScope === 'VENUE' ? selectedVenueIds : [],
            status: 'ACTIVE',
            starts_at: new Date().toISOString(),
            ends_at: banDuration === 'TEMPORARY' ? new Date(banEndDate).toISOString() : null,
            reason_category: banReasonCat,
            reason_text: banReasonText,
            notify_user: false,
            created_by_user_id: currentUser.id,
            created_at: Date.now()
        };

        await addBan(newBan);
        setShowBanModal(false);
    };

    // Helper to check active ban status
    const getUserBanStatus = (userId: string) => {
        const userBans = bans.filter(b => b.user_id === userId && b.status === 'ACTIVE');
        const isBusinessBanned = userBans.some(b => b.scope_type === 'BUSINESS');
        if (isBusinessBanned) return { status: 'Banned (Business)', color: 'text-red-500' };

        const venueBans = userBans.filter(b => b.scope_type === 'VENUE');
        if (venueBans.length > 0) return { status: `Banned (${venueBans.length} Venues)`, color: 'text-orange-500' };

        return { status: 'Active', color: 'text-emerald-500' };
    };



    // Form State
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'USER' as Role
    });

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const userToAdd: User = {
            id: Math.random().toString(36).substring(7),
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            assigned_venue_ids: [],
            assigned_area_ids: [],
            assigned_clicr_ids: [],
        };
        await addUser(userToAdd);
        setShowUserModal(false);
        setNewUser({ name: '', email: '', phone: '', role: 'USER' });
    };

    // Safety check - MOVED AFTER ALL HOOKS
    if (!currentUser) return <div className="p-8 text-white">Loading...</div>;

    // Loading State Handling - MOVED AFTER ALL HOOKS
    if (!business || !users) return <div className="p-8 text-white flex items-center gap-4"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> Loading Settings...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Settings</h1>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800 pb-2">
                <button
                    onClick={() => setActiveTab('business')}
                    className={`pb-2 px-1 font-medium transition-colors ${activeTab === 'business' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white'}`}
                >
                    Business Info
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-2 px-1 font-medium transition-colors ${activeTab === 'users' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white'}`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-2 px-1 font-medium transition-colors ${activeTab === 'profile' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-white'}`}
                >
                    My Account
                </button>
            </div>

            {/* Business Tab */}
            {activeTab === 'business' && business && (
                <div className="glass-panel p-8 rounded-xl max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-primary/20 rounded-full">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{business.name}</h2>
                            <p className="text-slate-400">ID: {business.id}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Timezone</label>
                            <input type="text" value={business.timezone} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Refresh Rate (sec)</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" defaultValue={business.settings.refresh_interval_sec}>
                                    <option value={3}>3s</option>
                                    <option value={5}>5s</option>
                                    <option value={10}>10s</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Reset Rule</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" defaultValue={business.settings.reset_rule}>
                                    <option value="MANUAL">Manual Only</option>
                                    <option value="SCHEDULED">Scheduled Daily</option>
                                </select>
                            </div>
                        </div>

                        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg mt-4 font-medium transition-colors">
                            <Save className="w-4 h-4" /> Save Changes
                        </button>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" /> Active Team
                        </h2>
                        <div className="flex gap-2">
                            <Link href="/settings/bans" className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-semibold border border-slate-700">
                                <History className="w-4 h-4" /> View Ban History
                            </Link>
                            <button onClick={() => setShowUserModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-bold">
                                <UserPlus className="w-4 h-4" /> Add User
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {users.map(user => {
                            const banStatus = getUserBanStatus(user.id);

                            return (
                                <div key={user.id} className={cn("glass-panel p-4 rounded-xl flex items-center justify-between border-l-4",
                                    banStatus.color === 'text-red-500' ? "border-l-red-500 bg-red-950/10" :
                                        banStatus.color === 'text-orange-500' ? "border-l-orange-500 bg-orange-950/10" : "border-l-transparent"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-400">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                {user.name}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border opacity-80 ${user.role === 'OWNER' ? 'border-amber-500 text-amber-500 bg-amber-500/10' :
                                                    user.role === 'ADMIN' ? 'border-purple-500 text-purple-500 bg-purple-500/10' :
                                                        user.role === 'SUPERVISOR' ? 'border-blue-500 text-blue-500 bg-blue-500/10' :
                                                            'border-slate-500 text-slate-500 bg-slate-500/10'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                                {banStatus.status !== 'Active' && (
                                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", banStatus.color, "border-current bg-current/10")}>
                                                        {banStatus.status}
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                                                <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</div>
                                                {user.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</div>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {user.role !== 'OWNER' && (
                                            <button
                                                onClick={() => handleOpenBanModal(user)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all flex items-center gap-2 group"
                                                title="Restrict Access / Ban"
                                            >
                                                <Ban className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs font-bold hidden group-hover:block">Ban</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setUserToRemove(user); setShowRemoveUserModal(true); }}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all text-xs font-bold"
                                            title="Remove User"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && currentUser && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
                    <div className="glass-panel p-8 rounded-xl">
                        <h2 className="text-xl font-bold text-white mb-6">Personal Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                                <input type="text" value={currentUser.name} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white opacity-60 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Email</label>
                                <input type="text" value={currentUser.email} readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white opacity-60 cursor-not-allowed" />
                            </div>
                        </div>
                    </div>

                    <div className="border border-red-900/30 bg-red-950/10 rounded-xl p-8">
                        <h3 className="text-lg font-bold text-red-500 mb-2">Danger Zone</h3>
                        <p className="text-slate-400 mb-6 text-sm">
                            Permanently delete your account and remove your access to all organizations.
                            This action cannot be undone.
                        </p>
                        <button
                            onClick={() => setShowDeleteAccountModal(true)}
                            className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                        >
                            Delete My Account
                        </button>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                                <input required type="text" className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white focus:border-primary outline-none"
                                    value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="e.g. John Doe" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                                <input required type="email" className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white focus:border-primary outline-none"
                                    value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                                <input type="tel" className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white focus:border-primary outline-none"
                                    value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} placeholder="555-0123" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Role</label>
                                <select className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white focus:border-primary outline-none"
                                    value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}>
                                    <option value="USER">User</option>
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold transition-colors">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Ban Modal */}
            {showBanModal && selectedUserToBan && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg my-8">
                        {/* Header with Ban Info Panel */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-4">
                                <Shield className="w-6 h-6 text-red-500" />
                                Restrict Access (Ban)
                            </h2>

                            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-sm text-slate-300 space-y-2">
                                <p><strong className="text-red-400">Banning will:</strong> Immediately remove access, block scanning, and log an audit record.</p>
                                <p><strong className="text-emerald-400">Banning will NOT:</strong> Delete historical data or change occupancy numbers.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Step 1: Scope */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white uppercase tracking-wider">1. Choose Scope</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setBanScope('BUSINESS')}
                                        className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                            banScope === 'BUSINESS'
                                                ? "border-red-500 bg-red-950/20 text-white"
                                                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600"
                                        )}
                                    >
                                        <div className="font-bold mb-1">Entire Business</div>
                                        <div className="text-xs opacity-70">Block access to all venues</div>
                                    </button>
                                    <button
                                        onClick={() => setBanScope('VENUE')}
                                        className={cn("p-4 rounded-xl border-2 text-left transition-all",
                                            banScope === 'VENUE'
                                                ? "border-orange-500 bg-orange-950/20 text-white"
                                                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600"
                                        )}
                                    >
                                        <div className="font-bold mb-1">Specific Venues</div>
                                        <div className="text-xs opacity-70">Restrict specific locations</div>
                                    </button>
                                </div>

                                {banScope === 'VENUE' && (
                                    <div className="mt-2 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 animate-in slide-in-from-top-2">
                                        <label className="text-xs text-slate-400 block mb-2">Select Venues to Ban:</label>
                                        {venues.map(v => (
                                            <label key={v.id} className="flex items-center gap-3 p-2 hover:bg-slate-900 rounded-lg cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVenueIds.includes(v.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setSelectedVenueIds([...selectedVenueIds, v.id]);
                                                        else setSelectedVenueIds(selectedVenueIds.filter(id => id !== v.id));
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 dark:focus:ring-offset-slate-900"
                                                />
                                                <span className="text-sm text-slate-200">{v.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Duration */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white uppercase tracking-wider">2. Duration</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="duration" checked={banDuration === 'PERMANENT'} onChange={() => setBanDuration('PERMANENT')} className="text-primary" />
                                        <span className="text-white">Permanent</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="duration" checked={banDuration === 'TEMPORARY'} onChange={() => setBanDuration('TEMPORARY')} className="text-primary" />
                                        <span className="text-white">Temporary</span>
                                    </label>
                                </div>
                                {banDuration === 'TEMPORARY' && (
                                    <input
                                        type="datetime-local"
                                        value={banEndDate}
                                        onChange={e => setBanEndDate(e.target.value)}
                                        className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white mt-2"
                                    />
                                )}
                            </div>

                            {/* Step 3: Reason */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white uppercase tracking-wider">3. Reason (Required)</label>
                                <select
                                    className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                    value={banReasonCat}
                                    onChange={e => setBanReasonCat(e.target.value)}
                                >
                                    <option>Policy Violation</option>
                                    <option>Security Concern</option>
                                    <option>Misuse of System</option>
                                    <option>No Longer Employed</option>
                                    <option>Venue Conflict</option>
                                    <option>Other</option>
                                </select>
                                <textarea
                                    className="w-full bg-black border border-slate-800 rounded-lg p-3 text-white h-24 mt-2 focus:border-red-500 outline-none"
                                    placeholder="Describe what happened, what scope applies, and any notes..."
                                    value={banReasonText}
                                    onChange={e => setBanReasonText(e.target.value)}
                                />
                            </div>

                            {/* Step 5: Confirmation */}
                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                    <span className="text-sm text-red-400 font-bold">Type 'BAN' to confirm this action</span>
                                </div>
                                <input
                                    type="text"
                                    className="w-full bg-red-950/20 border border-red-900/50 rounded-lg p-3 text-white text-center font-mono font-bold placeholder-red-900/50 tracking-widest uppercase mb-4"
                                    placeholder="BAN"
                                    value={banConfirmText}
                                    onChange={e => setBanConfirmText(e.target.value)}
                                />
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowBanModal(false)}
                                        className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmBan}
                                        disabled={banConfirmText !== 'BAN' || (banScope === 'VENUE' && selectedVenueIds.length === 0) || !banReasonText}
                                        className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
                                    >
                                        <Ban className="w-4 h-4" />
                                        Confirm Ban
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove User Modal */}
            {showRemoveUserModal && userToRemove && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
                        <h2 className="text-xl font-bold text-white mb-2">Remove User?</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to remove <span className="text-white font-bold">{userToRemove.name}</span>?
                            They will lose access immediately. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowRemoveUserModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={handleRemoveUser} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold">Remove User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal (Self) */}
            {showDeleteAccountModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-red-900/20">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-900/20 rounded-full text-red-500">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Delete Account?</h2>
                                <p className="text-red-400 font-medium">This is a destructive action.</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-slate-300 mb-8">
                            <p>You are about to permanently delete your account: <span className="font-bold text-white">{currentUser?.email}</span>.</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm opacity-80">
                                <li>You will lose access to all managed organizations instantly.</li>
                                <li>Your personal settings will be wiped.</li>
                                <li>This cannot be undone.</li>
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm text-slate-400">
                                To confirm, type <span className="font-bold text-white select-all">DELETE</span> below:
                            </label>
                            <input
                                type="text"
                                value={deleteAccountConfirm}
                                onChange={e => setDeleteAccountConfirm(e.target.value)}
                                className="w-full bg-black border border-red-900/30 rounded-lg p-3 text-white focus:border-red-500 outline-none font-bold text-center tracking-widest uppercase"
                                placeholder="DELETE"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
                            <button
                                onClick={() => { setShowDeleteAccountModal(false); setDeleteAccountConfirm(''); }}
                                className="px-6 py-3 text-slate-400 hover:text-white transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteAccountConfirm !== 'DELETE'}
                                className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all flex items-center gap-2"
                            >
                                Permanently Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
