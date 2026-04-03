import React, { useState } from 'react';
import { Settings, X, Camera, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Status: 'idle', 'pass', 'fail'
  const [verdictStatus, setVerdictStatus] = useState('idle');

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-400 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 relative z-10 bg-neutral-950">
        <h1 className="font-serif text-3xl text-neutral-200 tracking-wide select-none">
          veritas-q<span className="text-neutral-500">.</span>
        </h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-white/5 rounded-md transition-colors duration-200 cursor-pointer"
        >
          <Settings size={16} />
          <span>calibrate model</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column (Camera Feed) */}
        <section className="w-[70%] p-6 flex flex-col border-r border-white/10 relative">
          <div className="flex-1 bg-[#111111] rounded-xl relative overflow-hidden flex items-center justify-center border border-white/5 shadow-2xl">
            {/* Subtle radial gradient background to simulate glow of feed */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent pointer-events-none"></div>

            {/* Ghost Stencil */}
            <div className="relative w-80 h-80 sm:w-96 sm:h-96 border-2 border-dashed border-white/30 rounded-xl flex items-start justify-start p-4 transition-all duration-300">
              <span className="font-mono text-[10px] text-neutral-500 tracking-widest uppercase">
                align product here
              </span>
            </div>
            
            {/* Decorative status indicators */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse ring-4 ring-red-600/20"></div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest">Live Feed</span>
            </div>
          </div>
        </section>

        {/* Right Column (Telemetry Panel) */}
        <section className="w-[30%] flex flex-col bg-neutral-950">
          {/* Active Profile */}
          <div className="p-6 sm:p-8 border-b border-white/10">
            <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-2">Active Profile</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <p className="text-neutral-200 font-medium text-sm tracking-wide">alpha bracket v2</p>
            </div>
          </div>

          {/* Verdict Box */}
          <div className="flex-1 flex flex-col p-6 sm:p-8 border-b border-white/10 relative">
            <div className="w-full flex justify-end gap-2 absolute top-6 right-8 z-10">
               {/* Toggles for Demo */}
               <button onClick={() => setVerdictStatus('idle')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'idle' ? 'bg-neutral-400 ring-2 ring-white/20' : 'bg-neutral-800 hover:bg-neutral-600'}`} title="Idle"></button>
               <button onClick={() => setVerdictStatus('pass')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'pass' ? 'bg-emerald-500 ring-2 ring-emerald-500/50' : 'bg-emerald-900/40 hover:bg-emerald-700/60'}`} title="Pass"></button>
               <button onClick={() => setVerdictStatus('fail')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'fail' ? 'bg-rose-500 ring-2 ring-rose-500/50' : 'bg-rose-900/40 hover:bg-rose-700/60'}`} title="Fail"></button>
            </div>
            
            {verdictStatus === 'idle' && (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#111111] transition-all duration-700 ease-in-out relative overflow-hidden group">
                <Loader2 className="w-8 h-8 text-neutral-600 animate-spin mb-6" />
                <h3 className="font-serif text-3xl sm:text-4xl text-neutral-500 lowercase tracking-wide">awaiting item...</h3>
              </div>
            )}

            {verdictStatus === 'pass' && (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl bg-emerald-500 text-neutral-950 shadow-[0_0_80px_rgba(16,185,129,0.15)] transition-all duration-700 ease-in-out relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent pointer-events-none"></div>
                <CheckCircle2 className="w-14 h-14 mb-6 opacity-90 stroke-[1.5]" />
                <h3 className="font-serif text-5xl sm:text-6xl text-neutral-950 tracking-tight lowercase">pass</h3>
                <div className="mt-8 px-4 py-1.5 bg-neutral-950/10 rounded-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-80 font-semibold">confidence 99.8%</span>
                </div>
              </div>
            )}

            {verdictStatus === 'fail' && (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl bg-rose-600 text-neutral-50 shadow-[0_0_80px_rgba(225,29,72,0.2)] transition-all duration-700 ease-in-out relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent pointer-events-none"></div>
                <AlertTriangle className="w-14 h-14 mb-6 opacity-90 stroke-[1.5]" />
                <h3 className="font-serif text-5xl sm:text-6xl text-white tracking-tight lowercase">fail</h3>
                <div className="mt-8 px-4 py-1.5 bg-neutral-950/20 rounded-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-90 font-semibold">defect detected</span>
                </div>
              </div>
            )}
          </div>

          {/* Session Stats */}
          <div className="p-6 sm:p-8">
            <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-6">Session Stats</h2>
            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">total items</p>
                <div className="font-mono text-3xl text-neutral-200 font-light">142</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">yield rate</p>
                <div className="font-mono text-3xl text-neutral-200 font-light">97.1%</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">passed</p>
                <div className="font-mono text-3xl text-emerald-500/90 font-light">138</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">failed</p>
                <div className="font-mono text-3xl text-rose-500/90 font-light">4</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Calibration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-[520px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-8 transform scale-100 transition-transform">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-3xl text-neutral-200 lowercase">calibrate model</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-3">
                  Product Name
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. beta enclosure v1"
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3.5 text-neutral-200 font-sans text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-neutral-700" 
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-3">
                  Camera Feed Preview
                </label>
                <div className="w-full h-56 bg-[#111111] rounded-xl border border-white/5 flex flex-col items-center justify-center text-neutral-600 relative overflow-hidden group">
                  <Camera size={28} className="mb-4 opacity-40 group-hover:opacity-60 transition-opacity" strokeWidth={1.5} />
                  <span className="font-mono text-xs opacity-70">Waiting for video stream...</span>
                  <div className="absolute inset-0 border border-white/10 border-dashed m-5 rounded-lg opacity-50"></div>
                </div>
              </div>

              <div className="pt-2">
                <button className="w-full bg-white text-neutral-950 font-medium tracking-wide py-4.5 rounded-xl hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer">
                  capture 10 baseline frames
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
