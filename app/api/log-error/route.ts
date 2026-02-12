import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    const body = await request.json();
    const userId = request.headers.get('x-user-id');
    const { message, context, payload } = body;

    try {
        await supabaseAdmin.from('app_errors').insert({
            user_id: userId || null,
            error_message: message,
            context: context || 'client_reported',
            payload: payload
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to log error", e);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
