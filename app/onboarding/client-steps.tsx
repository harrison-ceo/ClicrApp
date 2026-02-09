'use client';

import { useState } from 'react';
import { Plus, Trash, ArrowRight, Building2, MapPin, Users, Smartphone, ArrowLeft } from 'lucide-react';
import { submitStep } from './actions';

export function StepContainer({ title, subtitle, children, stepNumber, totalSteps }: any) {
    return (
        <div className="w-full max-w-lg bg-slate-900/50 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest border border-primary/20 bg-primary/10 px-3 py-1 rounded-full">Step {stepNumber} of {totalSteps}</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
                <p className="text-slate-400">{subtitle}</p>
            </div>
            {children}
        </div>
    )
}

export function BusinessStep() {
    return (
        <form action={submitStep} className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Business Name</label>
                <div className="relative">
                    <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                    <input name="businessName" type="text" required placeholder="My Hospitality Group"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Number of Venues</label>
                <select name="venueCount" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                    {[1, 2, 3, 4, 5, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Venue' : 'Venues'}</option>)}
                </select>
            </div>
            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all">
                Continue <ArrowRight className="inline w-4 h-4 ml-2" />
            </button>
        </form>
    )
}

export function VenueStep({ index, total }: { index: number, total: number }) {
    return (
        <form action={submitStep} className="space-y-6">
            <input type="hidden" name="activeVenueIndex" value={index} />
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 text-sm text-primary font-medium">
                Setting up Venue {index + 1} of {total}
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Venue Name</label>
                <div className="relative">
                    <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                    <input name="venueName" type="text" required placeholder="e.g. Downtown Club"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Location</label>
                <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                    <input name="location" type="text" placeholder="City, State"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Max Capacity</label>
                <div className="relative">
                    <Users className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                    <input name="capacity" type="number" required min="1" placeholder="500"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                </div>
            </div>

            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all">
                Save & Continue
            </button>
        </form>
    )
}

export function AreaStep({ venueName, index }: { venueName: string, index: number }) {
    const [areas, setAreas] = useState([{ name: 'Main Entrance', capacity: '' }]);

    const addArea = () => setAreas([...areas, { name: '', capacity: '' }]);
    const removeArea = (i: number) => setAreas(areas.filter((_, idx) => idx !== i));
    const updateArea = (i: number, field: string, val: string) => {
        const newAreas = [...areas];
        (newAreas[i] as any)[field] = val;
        setAreas(newAreas);
    };

    return (
        <form action={submitStep} className="space-y-6">
            <input type="hidden" name="activeVenueIndex" value={index} />
            <input type="hidden" name="areas" value={JSON.stringify(areas)} />

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {areas.map((area, i) => (
                    <div key={i} className="flex gap-3 items-start p-4 bg-black/20 rounded-xl border border-white/5">
                        <div className="flex-1 space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Area Name</label>
                                <input
                                    value={area.name}
                                    onChange={(e) => updateArea(i, 'name', e.target.value)}
                                    required
                                    placeholder="e.g. VIP Lounge"
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white text-sm mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">Capacity (Optional)</label>
                                <input
                                    type="number"
                                    value={area.capacity}
                                    onChange={(e) => updateArea(i, 'capacity', e.target.value)}
                                    placeholder="Leave blank to use venue cap"
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white text-sm mt-1"
                                />
                            </div>
                        </div>
                        {areas.length > 1 && (
                            <button type="button" onClick={() => removeArea(i)} className="pt-8 text-slate-500 hover:text-red-400">
                                <Trash className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button type="button" onClick={addArea} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Another Area
            </button>

            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all">
                Save Areas
            </button>
        </form>
    )
}

export function ClicrStep({ venueName, areas, index }: { venueName: string, areas: any[], index: number }) {
    // Structure: map of areaId -> list of devices
    const [devicesMap, setDevicesMap] = useState<Record<string, { name: string, mode: string }[]>>(() => {
        const initial: any = {};
        areas.forEach(a => {
            initial[a.id] = [{ name: 'Main Clicr', mode: 'bidirectional' }];
        });
        return initial;
    });

    const addDevice = (areaId: string) => {
        setDevicesMap(prev => ({
            ...prev,
            [areaId]: [...(prev[areaId] || []), { name: '', mode: 'bidirectional' }]
        }));
    };

    const updateDevice = (areaId: string, idx: number, field: string, val: string) => {
        setDevicesMap(prev => {
            const list = [...(prev[areaId] || [])];
            (list[idx] as any)[field] = val;
            return { ...prev, [areaId]: list };
        });
    };

    const removeDevice = (areaId: string, idx: number) => {
        setDevicesMap(prev => {
            const list = [...(prev[areaId] || [])].filter((_, i) => i !== idx);
            return { ...prev, [areaId]: list };
        });
    };

    return (
        <form action={submitStep} className="space-y-6">
            <input type="hidden" name="activeVenueIndex" value={index} />
            <input type="hidden" name="devices" value={JSON.stringify(devicesMap)} />

            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {areas.map(area => (
                    <div key={area.id} className="space-y-3">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" /> {area.name}
                        </h3>

                        <div className="space-y-3 pl-4 border-l-2 border-white/10">
                            {(devicesMap[area.id] || []).map((dev, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 bg-white/5 rounded-lg">
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase font-bold">Clicr Name</label>
                                            <input
                                                value={dev.name}
                                                onChange={(e) => updateDevice(area.id, i, 'name', e.target.value)}
                                                required
                                                placeholder="Door 1 Left"
                                                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white text-xs mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase font-bold">Mode</label>
                                            <select
                                                value={dev.mode}
                                                onChange={(e) => updateDevice(area.id, i, 'mode', e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white text-xs mt-1"
                                            >
                                                <option value="bidirectional">In & Out (Bidirectional)</option>
                                                <option value="in_only">In Only</option>
                                                <option value="out_only">Out Only</option>
                                            </select>
                                        </div>
                                    </div>
                                    {(devicesMap[area.id] || []).length > 1 && (
                                        <button type="button" onClick={() => removeDevice(area.id, i)} className="pt-6 text-slate-500 hover:text-red-400">
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={() => addDevice(area.id)} className="text-xs text-primary font-bold hover:underline py-1">
                                + Add Clicr to {area.name}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all">
                Finish Setup
            </button>
        </form>
    )
}
