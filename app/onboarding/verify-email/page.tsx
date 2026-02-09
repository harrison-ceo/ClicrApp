
import Link from 'next/link';
import { Mail, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function VerifyEmailPage() {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-30 -z-10" />

            <div className="w-full max-w-md bg-slate-900/50 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20">
                        <Mail className="w-8 h-8 text-primary" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
                <p className="text-slate-400 mb-8">
                    We've sent a verification link to your email address.
                    Please click the link to verify your account and continue setup.
                </p>

                <div className="space-y-4">
                    <Link
                        href="/auth/signin"
                        className="block w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
                    >
                        I've Verified My Email <ArrowRight className="w-4 h-4" />
                    </Link>

                    <Link href="/onboarding/signup" className="block text-sm text-slate-500 hover:text-white transition-colors">
                        Wrong email? Try again
                    </Link>
                </div>
            </div>

            <div className="absolute bottom-8">
                <Logo className="w-24 h-8 opacity-50" />
            </div>
        </div>
    )
}
