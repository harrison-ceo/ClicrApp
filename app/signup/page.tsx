import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { signUp } from './actions'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SignupPage({ searchParams }: Props) {
    const params = await searchParams;
    const error = params.error as string;

    const returnTo = 'https://clicr.co';

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">

            <Link href={returnTo} className="absolute top-8 left-8 text-slate-500 hover:text-white flex items-center gap-2 transition-colors font-bold text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>

            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 border border-primary/20 shadow-lg shadow-primary/10">
                        <img src="/clicr-logo.png" alt="Clicr Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Create your account</h2>
                    <p className="mt-2 text-slate-400">Start your 14-day free pilot</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-center text-sm font-medium">
                        {error}
                    </div>
                )}

                <form action={signUp} className="mt-8 space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full rounded-t-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="relative block w-full rounded-b-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                placeholder="Create a password"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-xl bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 transition-all shadow-lg shadow-primary/25"
                        >
                            Create Account
                        </button>
                    </div>

                    <div className="text-center mt-6">
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <Link href="/login" className="text-white font-bold hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}
