
import { signup } from '../actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SignupPage({ searchParams }: Props) {
    const params = await searchParams;
    const error = params.error as string;

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <Link href="https://clicr.co" className="absolute top-8 left-8 text-slate-500 hover:text-white flex items-center gap-2 transition-colors font-bold text-sm z-10">
                <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>

            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-30 -z-10" />

            <div className="w-full max-w-md bg-slate-900/50 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        {/* Using the standard Logo component */}
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                            <Logo className="w-10 h-10" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">Start your 30-day free trial</h1>
                    <p className="text-slate-400 text-sm">Create your Clicr account in under 2 minutes.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                        {error}
                    </div>
                )}

                <form action={signup} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
                        <input name="email" type="email" required placeholder="you@company.com"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Password</label>
                        <input name="password" type="password" required minLength={8} placeholder="8+ characters"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Confirm Password</label>
                        <input name="confirmPassword" type="password" required minLength={8} placeholder="Repeat password"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                    </div>

                    <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all mt-4">
                        Continue
                    </button>

                    <p className="text-center text-xs text-slate-500 mt-4">
                        Already have an account? <Link href="/auth/signin" className="text-white hover:underline">Sign In</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
