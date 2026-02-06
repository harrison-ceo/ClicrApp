
import { Info } from 'lucide-react';
import { FEATURE_V4_LOGIN_NOTICE, V4_NOTICE_TITLE, V4_NOTICE_BODY } from '@/lib/constants/v4Launch';
import { cn } from '@/lib/utils';

export function V4LaunchNotice({ className }: { className?: string }) {
    if (!FEATURE_V4_LOGIN_NOTICE) return null;

    return (
        <div className={cn(
            "flex items-start gap-3 p-3 mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-left",
            className
        )}>
            <div className="p-1 rounded-full bg-blue-500/20 text-blue-400 mt-0.5">
                <Info size={14} strokeWidth={2.5} />
            </div>
            <div>
                <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wide mb-0.5">
                    {V4_NOTICE_TITLE}
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                    {V4_NOTICE_BODY}
                </p>
            </div>
        </div>
    );
}
