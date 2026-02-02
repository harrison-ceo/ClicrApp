'use server';

import { createTicket } from '@/lib/db';
import { SupportTicket } from '@/lib/types';
import { Resend } from 'resend';

// Helper to get Resend instance safely (prevents crashing if no key)
const getResend = () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

export type TicketFormData = {
    subject: string;
    description: string;
    category: 'TECHNICAL' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER' | 'COMPLIANCE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId: string;
    businessId: string;
};

export async function submitSupportTicket(data: TicketFormData) {
    console.log(`[SUPPORT] Processing ticket from ${data.userId}`);

    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Create Ticket Object
    const newTicket: SupportTicket = {
        id: ticketId,
        business_id: data.businessId,
        user_id: data.userId,
        subject: data.subject,
        status: 'OPEN',
        priority: data.priority,
        category: data.category as any,
        created_at: now,
        updated_at: now,
        messages: [
            {
                id: crypto.randomUUID(),
                ticket_id: ticketId,
                sender_id: data.userId,
                message_text: data.description,
                timestamp: now,
                is_internal: false
            }
        ]
    };

    // 2. Save to DB (Mock or Supabase)
    // LOCAL MOCK:
    createTicket(newTicket);

    // REAL SUPABASE (Uncomment when connected):
    /*
    const { error } = await supabase.from('support_tickets').insert({ ... });
    */

    // 3. Send Email Notification (to hello@clicrapp.com)
    await sendEmailNotification(newTicket);

    return { success: true, ticketId };
}

export async function getUserTickets(userId: string) {
    // 1. Fetch from DB
    // LOCAL MOCK:
    const { getTickets } = await import('@/lib/db'); // Dynamic import to avoid build issues if mixed
    const tickets = getTickets(userId);
    return tickets;

    // REAL SUPABASE:
    /*
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', userId);
    return data || [];
    */
}

async function sendEmailNotification(ticket: SupportTicket) {
    const resend = getResend();

    // 1. Simulation Mode (No API Key)
    if (!resend) {
        console.log('--- [SIMULATION EMAIL] ---');
        console.log(`To: harrison@clicrapp.com`);
        console.log(`Subject: New Ticket: ${ticket.subject}`);
        console.log(`Message: ${ticket.messages[0].message_text}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    // 2. Real Email Mode (Resend)
    try {
        const { data, error } = await resend.emails.send({
            from: 'CLICR Support <onboarding@resend.dev>', // Use this for testing until you verify domain
            to: ['harrison@clicrapp.com'],
            subject: `[${ticket.priority}] ${ticket.subject}`,
            html: `
                <h1>New Support Ticket</h1>
                <p><strong>Category:</strong> ${ticket.category}</p>
                <p><strong>User:</strong> ${ticket.user_id} (${ticket.business_id})</p>
                <hr />
                <h2>${ticket.subject}</h2>
                <p style="white-space: pre-wrap;">${ticket.messages[0].message_text}</p>
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
