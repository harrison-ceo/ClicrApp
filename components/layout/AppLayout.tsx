"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    MapPin,
    Layers,
    MousePointer2,
    ScanFace,
    BarChart3,
    Settings,
    LogOut,
    Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Venues', href: '/venues', icon: MapPin },
    { label: 'Areas', href: '/areas', icon: Layers },
    { label: 'Clicr', href: '/clicr', icon: MousePointer2 },
    { label: 'Guests', href: '/guests', icon: ScanFace },
    { label: 'Banning', href: '/banning', icon: Ban },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Support', href: '/support', icon: Building2 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { currentUser } = useApp();

    return (
        // Root container: Fixed to viewport edges (inset-0) to guarantee full coverage
        // Flex Column to stack content and nav naturally
        <div className="fixed inset-0 w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden">

            {/* Sidebar (Desktop) */}
            <aside className="w-64 border-r border-border bg-card/50 hidden md:flex flex-col glass-panel z-20 shrink-0">
                <div className="p-6 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <div className="relative w-32 h-10">
                            {/* Using standard img for quick file reference compatibility */}
                            <img src="/clicr-logo.png" alt="CLICR" className="w-full h-full object-contain object-left" />
                        </div>
                        <Link href="/settings" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">v1.0.0 • {currentUser.role}</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                                    isActive
                                        ? "bg-primary text-white font-bold shadow-lg shadow-primary/25"
                                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border/50">
                    <button className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            {/* flex-1 grows to fill space, pushing Nav to bottom. min-h-0 prevents overflow issues. */}
            <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto overscroll-none p-4 md:p-8">
                    {/* Background Gradients */}
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto min-h-full">
                        {children}
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Navigation - Natural Flex Child */}
            {/* No 'fixed'. Just sits at the bottom of the flex column. */}
            <nav className="md:hidden flex-none bg-[#0f1116] border-t border-white/10 pb-[env(safe-area-inset-bottom)] z-50">
                <div className="flex justify-around items-center p-2">
                    {NAV_ITEMS.filter(i => !['Venues', 'Areas'].includes(i.label)).map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16",
                                    isActive
                                        ? "text-primary"
                                        : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-full transition-all",
                                    isActive ? "bg-primary/20" : "bg-transparent"
                                )}>
                                    <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                                </div>
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </Link>
                        );
                    })}
                    <Link
                        href="/settings"
                        className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16",
                            pathname.startsWith('/settings')
                                ? "text-primary"
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <div className={cn(
                            "p-1.5 rounded-full transition-all",
                            pathname.startsWith('/settings') ? "bg-primary/20" : "bg-transparent"
                        )}>
                            <Settings className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold">More</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
