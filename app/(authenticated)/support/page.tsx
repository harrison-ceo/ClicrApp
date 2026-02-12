'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitSupportTicket, getUserTickets } from '@/app/actions/support';
import type { SupportTicketRow } from '@/app/actions/support';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRole } from '@/components/RoleContext';

export default function SupportPage() {
    const role = useRole();
    const isStaff = role === 'staff';
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'SUBMITTING' | 'SUCCESS'>('IDLE');
    const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
    const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
    const [venuesLoaded, setVenuesLoaded] = useState(false);

    // Fetch tickets on load
    React.useEffect(() => {
        if (isCreating) return;
        const loadTickets = async () => {
            const userTickets = await getUserTickets();
            setTickets(userTickets);
        };
        loadTickets();
    }, [status, isCreating]); // Reload when status changes (after submission)

    React.useEffect(() => {
        if (!isCreating || venuesLoaded) return;
        const loadVenues = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('venues')
                .select('id, name')
                .order('name', { ascending: true });
            setVenues(data ?? []);
            setVenuesLoaded(true);
        };
        loadVenues();
    }, [isCreating, venuesLoaded]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('SUBMITTING');

        try {
            await submitSupportTicket({
                subject: (document.getElementById('subject') as HTMLInputElement).value,
                description: (document.getElementById('description') as HTMLTextAreaElement).value,
                category: ((document.getElementById('category-select') as HTMLSelectElement).value) as any,
                priority: ((document.getElementById('priority-select') as HTMLSelectElement).value) as any,
                venueId: (document.getElementById('venue-select') as HTMLSelectElement)?.value || null,
            });

            setStatus('SUCCESS');
            setTimeout(() => {
                setIsCreating(false);
                setStatus('IDLE');
            }, 2000);
        } catch (err) {
            console.error(err);
            setStatus('IDLE'); // Handle error state ideally
        }
    };

    const getPriorityClass = (priority: string) => {
        switch (priority) {
            case 'CRITICAL':
                return 'bg-red-900 text-red-200';
            case 'HIGH':
                return 'bg-orange-900 text-orange-200';
            default:
                return 'bg-blue-900 text-blue-200';
        }
    };

    const getVenueName = (ticket: SupportTicketRow) => {
        if (!ticket.venues) return null;
        if (Array.isArray(ticket.venues)) return ticket.venues[0]?.name ?? null;
        return ticket.venues.name ?? null;
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Support Center</h1>
                    <p className="text-slate-400 mt-1">Get help with technical issues, billing, or feature requests.</p>
                </div>
                {!isCreating && !isStaff && (
                    <Button onClick={() => setIsCreating(true)} className="bg-indigo-600 hover:bg-indigo-500">
                        <Plus className="mr-2 h-4 w-4" />
                        New Ticket
                    </Button>
                )}
            </div>

            {!isStaff && isCreating ? (
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle>Create New Ticket</CardTitle>
                        <CardDescription>Describe your issue in detail so we can help you faster.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {status === 'SUCCESS' ? (
                            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-medium text-white">Ticket Submitted!</h3>
                                <p className="text-slate-400 text-center">We'll respond to your email shortly.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category</Label>
                                        <select
                                            id="category-select"
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            defaultValue="TECHNICAL"
                                        >
                                            <option value="TECHNICAL">Technical Issue</option>
                                            <option value="BILLING">Billing & Account</option>
                                            <option value="FEATURE_REQUEST">Feature Request</option>
                                            <option value="COMPLIANCE">Compliance / Legal</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="venue">Venue</Label>
                                        <select
                                            id="venue-select"
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            defaultValue=""
                                        >
                                            <option value="">No specific venue</option>
                                            {venues.map((venue) => (
                                                <option key={venue.id} value={venue.id}>
                                                    {venue.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority</Label>
                                        <select
                                            id="priority-select"
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            defaultValue="MEDIUM"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical (System Down)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input id="subject" placeholder="Brief summary of the issue" required className="bg-slate-950 border-slate-800" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Please maintain state compliance..."
                                        className="h-32 bg-slate-950 border-slate-800"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end space-x-2 pt-4">
                                    <Button variant="ghost" type="button" onClick={() => setIsCreating(false)}>Cancel</Button>
                                    <Button type="submit" disabled={status === 'SUBMITTING'} className="bg-indigo-600">
                                        {status === 'SUBMITTING' ? 'Submitting...' : 'Submit Ticket'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-lg bg-slate-950/50">
                            <MessageSquare className="h-10 w-10 text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-white">No Open Tickets</h3>
                            <p className="text-slate-400 max-w-sm text-center mt-2">
                                Good news! You have no pending support requests.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-white mb-4">Your Tickets</h2>
                            {tickets.map(ticket => (
                                <div key={ticket.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors cursor-pointer">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded textxs font-bold uppercase ${getPriorityClass(ticket.priority)}`}>
                                                {ticket.priority}
                                            </span>
                                            <span className="text-slate-500 text-xs font-mono">#{ticket.id.slice(0, 8)}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${ticket.status === 'OPEN' ? 'bg-green-900/30 text-green-400' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <h3 className="text-white font-semibold">{ticket.subject}</h3>
                                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                                        {ticket.support_ticket_messages?.[0]?.message_text ?? 'No message provided.'}
                                    </p>
                                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                        <span>
                                            {ticket.venue_id && getVenueName(ticket)
                                                ? `${ticket.category} • ${getVenueName(ticket)}`
                                                : ticket.category}
                                        </span>
                                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-lg flex items-start gap-4">
                        <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-blue-200">Compliance Notice</h4>
                            <p className="text-sm text-blue-300/80 mt-1">
                                Your ID scanning data retention is currently set to <strong>7 Days (TX Rule)</strong>.
                                Changes to retention policies usually take 24 hours to propagate across all devices.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
