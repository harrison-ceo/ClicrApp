'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/signup?error=Please enter your email and password')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    const isRateLimit = msg.includes('rate limit') || msg.includes('email rate limit')
    const friendly = isRateLimit
      ? 'Too many signup emails sent. Please try again in an hour.'
      : error.message
    redirect(`/signup?error=${encodeURIComponent(friendly)}`)
  }

  if (data.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      email,
      role: 'org_owner',
    }, { onConflict: 'id' })
  }

  if (data.user && !data.session) {
    redirect('/login?message=Check your email to confirm your account.')
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}
