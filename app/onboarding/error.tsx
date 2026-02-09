'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Onboarding Error Boundary caught:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
                <p className="text-slate-400 mb-6">
                    We encountered an error during your setup.
                </p>

                <div className="bg-red-950/30 border border-red-500/20 p-4 rounded-lg mb-6 text-left overflow-auto max-h-40">
                    <p className="font-mono text-xs text-red-300 break-all">
                        {error.message || 'Unknown error'}
                    </p>
                    {error.digest && (
                        <p className="font-mono text-[10px] text-red-500/60 mt-2">ID: {error.digest}</p>
                    )}
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-slate-200"
                    >
                        Try Again
                    </button>
                    <Link href="/auth/signin" className="px-6 py-2 border border-white/20 text-white font-bold rounded-full hover:bg-white/10">
                        Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
