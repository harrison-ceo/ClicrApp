'use server';

import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

type SupportTicket = {
    id: string;
    user_id: string;
    org_id: string | null;
    venue_id: string | null;
    subject: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
};

export type SupportTicketRow = {
    id: string;
    user_id: string;
    venue_id: string | null;
    subject: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
    venues?: { name: string } | { name: string }[] | null;
    support_ticket_messages?: { message_text: string; created_at: string }[];
};

// Helper to get Resend instance safely (prevents crashing if no key)
const getResend = () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

const getSupportEmail = () => {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'harrison@clicrapp.com';
}

export type TicketFormData = {
    subject: string;
    description: string;
    category: 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER' | 'COMPLIANCE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    venueId?: string | null;
};

export async function submitSupportTicket(data: TicketFormData) {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
        throw new Error('You must be signed in to submit a ticket.');
    }

    const userId = authData.user.id;
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id, venue_id')
        .eq('id', userId)
        .single();

    if (profileError) {
        throw new Error(profileError.message);
    }

    const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
            user_id: userId,
            org_id: profile?.org_id ?? null,
            venue_id: data.venueId ?? profile?.venue_id ?? null,
            subject: data.subject,
            status: 'OPEN',
            priority: data.priority,
            category: data.category,
        })
        .select('id, user_id, org_id, venue_id, subject, status, priority, category, created_at')
        .single();

    if (ticketError || !ticket) {
        throw new Error(ticketError?.message ?? 'Failed to create ticket.');
    }

    const { error: messageError } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: userId,
        message_text: data.description,
        is_internal: false,
    });

    if (messageError) {
        throw new Error(messageError.message);
    }

    await sendEmailNotification(ticket, data.description);
    return { success: true, ticketId: ticket.id };
}

export async function getUserTickets(): Promise<SupportTicketRow[]> {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
        return [];
    }

    const { data, error } = await supabase
        .from('support_tickets')
        .select('id, user_id, venue_id, subject, status, priority, category, created_at, venues(name), support_ticket_messages(message_text, created_at)')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false })
        .order('created_at', { referencedTable: 'support_ticket_messages', ascending: true });

    if (error || !data) return [];
    return data;
}

async function sendEmailNotification(ticket: SupportTicket, description: string) {
    const resend = getResend();

    // 1. Simulation Mode (No API Key)
    if (!resend) {
        console.log('--- [SIMULATION EMAIL] ---');
        console.log(`To: ${getSupportEmail()}`);
        console.log(`Subject: New Ticket: ${ticket.subject}`);
        console.log(`Message: ${description}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    // 2. Real Email Mode (Resend)
    try {
        const { data, error } = await resend.emails.send({
            from: 'CLICR Support <onboarding@resend.dev>', // Use this for testing until you verify domain
            to: [getSupportEmail()],
            subject: `[${ticket.priority}] ${ticket.subject}`,
            html: `
                <h1>New Support Ticket</h1>
                <p><strong>Category:</strong> ${ticket.category}</p>
                <p><strong>User:</strong> ${ticket.user_id} (${ticket.org_id ?? 'no-org'})</p>
                <hr />
                <h2>${ticket.subject}</h2>
                <p style="white-space: pre-wrap;">${description}</p>
                <hr />
                <p><a href="https://clicrapp.com/admin/tickets/${ticket.id}">View in Admin Dashboard</a></p>
            `
        });

        if (error) {
            console.error('Resend API Error:', error);
            throw new Error(error.message);
        }

        console.log(`[RESEND] Email sent successfully: ${data?.id}`);
    } catch (err) {
        console.error('Failed to send email via Resend:', err);
    }
}
