'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ShieldAlert, FileText, Download } from 'lucide-react';
import { IDScanEvent } from '@/lib/types';
import { readDB } from '@/lib/db'; // In production, this would be a Server Action fetching Supabase
import { ComplianceEngine } from '@/lib/compliance';

// Mock fetching function (client-side for prototype)
// In production, move to a Server Component or Server Action
function useGuests() {
    const [scans, setScans] = useState<IDScanEvent[]>([]);

    useEffect(() => {
        // Simulating API fetch
        // In real app: const data = await fetch('/api/guests').json();
        // Here we just grab mock data from localStorage or similar if we could, 
        // but since readDB is server-side only in Next.js (usually), 
        // we'll mock the data array directly here for the UI demo.

        const MOCK_SCANS: IDScanEvent[] = [
            {
                id: 'scan_1', timestamp: Date.now() - 100000, venue_id: 'ven_1', scan_result: 'ACCEPTED',
                age: 25, age_band: '21-24', sex: 'M', zip_code: '10001',
                first_name: 'John', last_name: 'Doe', issuing_state: 'NY', id_number_last4: '1234'
            },
            {
                id: 'scan_2', timestamp: Date.now() - 500000, venue_id: 'ven_1', scan_result: 'DENIED',
                age: 17, age_band: '18-20', sex: 'F', zip_code: '90210',
                first_name: 'Jane', last_name: 'Smith', issuing_state: 'CA', id_number_last4: '9876'
            },
            {
                id: 'scan_3', timestamp: Date.now() - 200000000, venue_id: 'ven_1', scan_result: 'ACCEPTED',
                age: 30, age_band: '30+', sex: 'M', zip_code: '78701',
                first_name: 'Bob', last_name: 'Texas', issuing_state: 'TX', id_number_last4: '4567'
            }
        ];

        setScans(MOCK_SCANS);
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                                {filteredScans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-500">
                                            No guests found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredScans.map((scan) => {
                                        const state = scan.issuing_state || 'Unknown';
                                        const rule = ComplianceEngine.getRule(state);
                                        const isRestricted = !rule.storePII;
                                        const complianceReason = ComplianceEngine.getRestrictionReason(state);

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
