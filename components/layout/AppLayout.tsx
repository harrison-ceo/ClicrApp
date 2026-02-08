"use client";

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    Building2,
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
import { RoleProvider, type AppRole } from '@/components/RoleContext';
import { Button } from '../ui/button';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Areas', href: '/areas', icon: Layers },
    { label: 'Clicr', href: '/clicr', icon: MousePointer2 },
    { label: 'Guests', href: '/guests', icon: ScanFace },
    { label: 'Banning', href: '/banning', icon: Ban },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Support', href: '/support', icon: Building2 },
];

export function AppLayout({ children, role = null }: Readonly<{ children: React.ReactNode; role?: AppRole }>) {
    const pathname = usePathname();
    const router = useRouter();
    const { currentUser } = useApp();
    const supabase = createClient();

    const isStaff = role === 'staff';
    const staffAllowedPrefixes = useMemo(() => ['/areas', '/clicr', '/support', '/banning'], []);
    const isStaffAllowed = useMemo(
        () => staffAllowedPrefixes.some((prefix) => pathname.startsWith(prefix)),
        [pathname, staffAllowedPrefixes]
    );

    useEffect(() => {
        if (isStaff && !isStaffAllowed) {
            router.replace('/areas');
        }
    }, [isStaff, isStaffAllowed, router]);

    const navItems = useMemo(() => {
        if (!isStaff) return NAV_ITEMS;
        return NAV_ITEMS.filter((item) => staffAllowedPrefixes.includes(item.href));
    }, [isStaff, staffAllowedPrefixes]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push('/login');
    };

    return (
        <RoleProvider role={role}>
        {/* Root container: Fixed to viewport edges (inset-0) to guarantee full coverage */}
        <div className="fixed inset-0 w-full bg-background text-foreground flex flex-col overflow-hidden">
            {/* Header Nav */}
            <header className="z-30">
                <div className="px-4 pt-4 md:px-8">
                    <div className="h-14 rounded-full border border-white/10 bg-slate-900/70 backdrop-blur-xl px-4 flex items-center justify-between shadow-lg shadow-black/20">
                        <div className="flex items-center gap-3">
                            <div className="relative w-24 h-8">
                                <img src="/clicr-logo.png" alt="CLICR" className="w-full h-full object-contain object-left" />
                            </div>
                            <span className="hidden md:inline text-xs text-muted-foreground">
                                v1.0.0 • {role ?? currentUser?.role ?? '—'}
                            </span>
                        </div>

                        <nav className="hidden lg:flex items-center gap-6">
                            {navItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "text-sm font-medium transition-colors",
                                            isActive ? "text-white" : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="flex items-center gap-2">
                            <Link
                                href="/settings"
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                                title="Settings"
                            >
                                <Settings className="w-5 h-5" />
                            </Link>
                            <Button className='rounded-full text-slate-400 cursor-pointer hover:bg-slate-800' variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            {/* flex-1 grows to fill space, pushing Nav to bottom. min-h-0 prevents overflow issues. */}
            <main className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto overscroll-none p-4 md:p-8 pt-6">
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
                    {navItems
                        .filter((item) => !['Venues', 'Areas'].includes(item.label))
                        .map((item) => {
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
        </RoleProvider>
    );
}
