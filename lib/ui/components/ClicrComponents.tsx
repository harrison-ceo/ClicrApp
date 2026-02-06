
import React from 'react';
import { cn } from '@/lib/utils'; // Assuming cn exists
import { tokens } from '../tokens';

interface MetricCardProps {
    label: string;
    value: number | string;
    className?: string;
}

export function MetricCard({ label, value, className }: MetricCardProps) {
    return (
        <div className={cn(
            "bg-[#111827] border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center min-w-[80px]",
            className
        )}>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{label}</span>
            <span className="text-xl text-white font-bold">{value}</span>
        </div>
    );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'in' | 'out';
    label: string;
    icon?: React.ReactNode;
}

export function ActionButton({ variant = 'in', label, icon, className, ...props }: ActionButtonProps) {
    // Both are blue in the reference, maybe 'out' is slightly different or same?
    // User reference image 1 shows both are blue. content is "GUEST IN" vs "GUEST OUT".
    // I will use the same blue primary for both.

    return (
        <button
            className={cn(
                "w-full h-32 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-white shadow-lg",
                "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF]", // Bright Blue
                className
            )}
            {...props}
        >
            {icon && <div className="text-white/90">{icon}</div>}
            <span className="text-sm font-bold tracking-widest uppercase">{label}</span>
        </button>
    );
}

export function OccupancyDisplay({ count, capacity, percent }: { count: number | null | undefined, capacity?: number, percent?: number }) {
    return (
        <div className="flex flex-col items-center justify-center py-8">
            <h1 className="text-[7rem] leading-none font-bold text-white tracking-tighter tabular-nums drop-shadow-2xl">
                {count ?? '—'}
            </h1>

            {capacity && (
                <div className="flex items-center gap-2 mt-4">
                    <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                        CAP {capacity}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        {percent ?? 0}% FULL
                    </span>
                </div>
            )}
        </div>
    );
}
