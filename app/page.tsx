
import Link from 'next/link';
import { ArrowRight, BarChart3, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-24 h-24 flex items-center justify-center p-2">
              <img src="/clicr-logo.png" alt="Clicr" className="w-20 h-20 object-contain" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/onboarding/signup" className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-3xl opacity-30 -z-10" />

        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            The Modern Standard for Venue Intelligence.
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Replace outdated tally counters with a powerful, real-time occupancy platform.
            Track capacity, ban bad actors, and automate your reporting.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/onboarding/signup" className="w-full sm:w-auto px-8 py-4 bg-primary rounded-full font-bold text-lg hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/demo" className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-full font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center">
              View Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <Feature
            icon={<BarChart3 />}
            title="Real-Time Analytics"
            desc="Monitor occupancy flow, peak hours, and gender ratios instantly from any device."
          />
          <Feature
            icon={<ShieldCheck />}
            title="Security & Banning"
            desc="Scan IDs to instantly flag banned patrons. Share ban lists securely across your venue network."
          />
          <Feature
            icon={<Zap />}
            title="Instant Sync"
            desc="Connect multiple clickers at multiple doors. Everyone stays in sync with sub-second latency."
          />
        </div>
      </div>

    </div >
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="space-y-4">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}
