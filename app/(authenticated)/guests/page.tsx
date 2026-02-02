'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Search, ShieldAlert, FileText, Download, Ban } from 'lucide-react';
import { IDScanEvent } from '@/lib/types';
import { ComplianceEngine } from '@/lib/compliance';

// Real data fetch hook
function useGuests() {
    const [scans, setScans] = useState<IDScanEvent[]>([]);

    // In a real app with venue selection, we'd pass venueId here.
    // For now, we fetch all (or filtered by server default)
    useEffect(() => {
        const fetchScans = async () => {
            // ... existing data fetching logic remains same but ensuring we have it right
            const { getRecentScansAction } = await import('@/app/actions/scan');
            const data = await getRecentScansAction();
            setScans(data);
        };
        fetchScans();

        // Optional: Poll for updates every 30s
        const interval = setInterval(fetchScans, 30000);
        return () => clearInterval(interval);
    }, []);

    return scans;
}

export default function GuestDirectoryPage() {
    const allScans = useGuests();
    const [searchTerm, setSearchTerm] = useState('');
    const [stateFilter, setStateFilter] = useState('ALL');

    const filteredScans = allScans.filter(scan => {
        const matchesSearch =
            (scan.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
            (scan.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
            (scan.id_number_last4?.includes(searchTerm));

        const matchesState = stateFilter === 'ALL' || scan.issuing_state === stateFilter;

        return matchesSearch && matchesState;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Guest Directory</h1>
                    <p className="text-slate-400 mt-1">
                        View scanned ID data. Visibility is strictly controlled by state compliance rules.
                    </p>
                </div>
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
                    <Download className="mr-2 h-4 w-4" />
                    Export Log
                </Button>
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search by name or last 4..."
                                className="pl-9 bg-slate-950 border-slate-800"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={stateFilter}
                            onChange={(e) => setStateFilter(e.target.value)}
                            className="w-[180px] flex h-10 items-center justify-between rounded-md border border-input bg-slate-950 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-800"
                        >
                            <option value="ALL">All States</option>
                            <option value="TX">Texas (TX)</option>
                            <option value="CA">California (CA)</option>
                            <option value="NY">New York (NY)</option>
                            <option value="FL">Florida (FL)</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-slate-800 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-950 text-slate-400 font-medium">
                                <tr>
                                    <th className="p-4">Time</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Age / ID</th>
                                    <th className="p-4">State</th>
                                    <th className="p-4">Result</th>
                                    <th className="p-4">Compliance Status</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                {filteredScans.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-500">
                                            No guests found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredScans.map((scan) => {
                                        const state = scan.issuing_state || 'Unknown';
                                        const rule = ComplianceEngine.getRule(state);
                                        const isRestricted = !rule.storePII;
                                        const complianceReason = ComplianceEngine.getRestrictionReason(state);

                                        // Construct ban URL
                                        const params = new URLSearchParams();
                                        if (scan.first_name) params.set('fname', scan.first_name);
                                        if (scan.last_name) params.set('lname', scan.last_name);
                                        if (scan.dob) params.set('dob', scan.dob || '');
                                        if (scan.id_number_last4) params.set('id_last4', scan.id_number_last4);

                                        const banLink = `/banning?mode=create&${params.toString()}`;

                                        return (
                                            <tr key={scan.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="p-4 text-slate-300">
                                                    {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(scan.timestamp).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-medium text-white">
                                                    {isRestricted ? (
                                                        <span className="italic text-slate-600">Redacted</span>
                                                    ) : (
                                                        `${scan.last_name}, ${scan.first_name}`
                                                    )}
                                                </td>
                                                <td className="p-4 text-slate-300">
                                                    {scan.age} <span className="text-slate-500 mx-1">•</span> ···{scan.id_number_last4}
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className="bg-slate-950 text-slate-400 border-slate-700">
                                                        {state}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <Badge className={
                                                        scan.scan_result === 'DENIED' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' :
                                                            'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                    }>
                                                        {scan.scan_result}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    {isRestricted ? (
                                                        <div className="flex items-center text-amber-500 text-xs gap-1.5">
                                                            <ShieldAlert className="h-3.5 w-3.5" />
                                                            {complianceReason}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center text-emerald-600 text-xs gap-1.5">
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Full Record
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {!isRestricted && (
                                                        <Link href={banLink}>
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                                                <Ban className="h-4 w-4" />
                                                                <span className="sr-only">Ban Patron</span>
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
