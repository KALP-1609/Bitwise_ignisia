import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Camera, CheckCircle2, AlertTriangle, Loader2, UploadCloud, ImageIcon, PauseCircle, PlayCircle, Power, Download } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const yieldData = [
  { time: '10:00', yield: 92 },
  { time: '10:10', yield: 94 },
  { time: '10:20', yield: 93 },
  { time: '10:30', yield: 97 },
  { time: '10:40', yield: 96 },
  { time: '10:50', yield: 98 },
  { time: '11:00', yield: 97.1 }
];

const defectData = [
  { name: 'Scratches', value: 45, fill: '#ef4444' }, // rose-500
  { name: 'Misalignment', value: 30, fill: '#f59e0b' }, // amber-500
  { name: 'Dimensional', value: 25, fill: '#8b5cf6' }, // violet-500
];

const recentDefects = [
  { id: 'def-1', time: '13:42', type: 'Scratches', img: 'placeholder' },
  { id: 'def-2', time: '13:15', type: 'Misalignment', img: 'placeholder' },
  { id: 'def-3', time: '11:04', type: 'Dimensional', img: 'placeholder' },
  { id: 'def-4', time: '09:21', type: 'Scratches', img: 'placeholder' },
];

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(true);
  const [isTraining, setIsTraining] = useState(false);

  // App States
  const [verdictStatus, setVerdictStatus] = useState('idle'); // 'idle', 'pass', 'fail'
  const [calibrationImages, setCalibrationImages] = useState([]);
  const [heatmapOverlay, setHeatmapOverlay] = useState(null);

  // Hardware & Camera States
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Refs for video capture loop
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const isShiftActiveRef = useRef(true);

  // Sync ref with state
  useEffect(() => {
    isShiftActiveRef.current = isShiftActive;
  }, [isShiftActive]);

  // 1. Fetch available cameras on mount
  useEffect(() => {
    const getCameras = async () => {
      try {
        // Request immediate permissions to ensure labels aren't blank
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId); // Default to first available camera
        }
      } catch (err) {
        console.error('Error accessing hardware webcams:', err);
      }
    };
    getCameras();
  }, []);

  // 2. Attach video stream whenever selected camera changes
  useEffect(() => {
    if (!selectedCameraId) return;

    let stream = null;
    const startStream = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedCameraId } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error starting video stream:', err);
      }
    };

    startStream();

    // Cleanup tracks on unmount / camera switch
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCameraId]);

  // 3. Main WebSocket & Capture engine loop
  useEffect(() => {
    // Connect to backend
    wsRef.current = new WebSocket('ws://10.23.40.96:8000/ws/stream');

    wsRef.current.onopen = () => {
      console.log('✅ WebSocket Connected to AI Backend API');

      // Begin 300ms capture loop (roughly ~3 FPS) to prevent crashing the server
      captureIntervalRef.current = setInterval(() => {
        if (!isShiftActiveRef.current) return; // Halt capture if paused

        if (videoRef.current && canvasRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d', { willReadFrequently: true });

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Extract Frame
            const base64Frame = canvas.toDataURL('image/jpeg', 0.8);

            // Transmit frame
            wsRef.current.send(base64Frame);
          }
        }
      }, 300);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);

        if (response.is_defective === true) {
          // Failure Mode
          setVerdictStatus('fail');
          if (response.heatmap_base64) {
            // Append standard base64 data wrapper if backend doesn't supply it
            const mapSrc = response.heatmap_base64.startsWith('data:image')
              ? response.heatmap_base64
              : `data:image/jpeg;base64,${response.heatmap_base64}`;
            setHeatmapOverlay(mapSrc);
          }
        } else if (response.is_defective === false) {
          // Pass Mode
          setVerdictStatus('pass');
          setHeatmapOverlay(null); // Clear heatmap
        } else {
          setVerdictStatus('idle');
          setHeatmapOverlay(null);
        }

      } catch (e) {
        console.error('Failed to parse JSON response:', e);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket Connection Error', error);
    };

    wsRef.current.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };

    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + calibrationImages.length > 10) {
      alert('You can only upload up to 10 images');
      return;
    }
    const newImages = files.map(f => URL.createObjectURL(f));
    setCalibrationImages(prev => [...prev, ...newImages].slice(0, 10));
  };

  const handleTrainModel = () => {
    setIsTraining(true);
    // Simulate AI model training processing delay
    setTimeout(() => {
      setIsTraining(false);
      setIsModalOpen(false); // Close calibration modal
      setCalibrationImages([]); // Reset images
      alert('Model successfully calibrated to the new baseline images!');
    }, 2500);
  };

  const handleEndShift = () => {
    setIsShiftActive(false);
    setShowSummaryModal(true);
  };

  const exportCSV = () => {
    const headers = "Time,Defect Type,ID\n";
    const rows = recentDefects.map(d => `${d.time},${d.type},${d.id}`).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `shift_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-400 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 relative z-10 bg-neutral-950">
        <h1 className="font-serif text-3xl font-bold text-neutral-200 tracking-wide select-none">
          defeX<span className="text-neutral-500">.</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setIsShiftActive(!isShiftActive)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 cursor-pointer ${isShiftActive
              ? 'text-amber-500 hover:bg-amber-500/10'
              : 'text-emerald-500 hover:bg-emerald-500/10'
              }`}
          >
            {isShiftActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            <span>{isShiftActive ? 'pause' : 'resume'}</span>
          </button>

          <button
            onClick={handleEndShift}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 rounded-md transition-colors duration-200 cursor-pointer border border-rose-500/20"
          >
            <Power size={16} />
            <span>end shift</span>
          </button>

          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-white/5 rounded-md transition-colors duration-200 cursor-pointer"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">calibrate model</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column (Camera Feed & Defect Gallery) */}
        <section className="w-[70%] p-6 flex flex-col relative overflow-hidden">
          {/* Camera Feed Context */}
          <div className="flex-1 bg-[#111111] rounded-xl relative overflow-hidden flex items-center justify-center border border-white/5 shadow-2xl mb-6 min-h-0 bg-neutral-900 group">

            {/* The Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-90"
            />

            {/* Paused Overlay */}
            {!isShiftActive && (
              <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center transition-all duration-300 pointer-events-none">
                <PauseCircle className="w-16 h-16 text-neutral-400 mb-4 opacity-70" strokeWidth={1.5} />
                <h2 className="font-serif text-3xl text-neutral-300 lowercase tracking-widest">shift paused</h2>
              </div>
            )}

            {/* Hidden Canvas used purely for logic scraping */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Heatmap Overlay for Defective parts */}
            {heatmapOverlay && (
              <img
                src={heatmapOverlay}
                alt="Defect Heatmap"
                className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen pointer-events-none transition-opacity duration-300"
              />
            )}

            {/* Ghost Stencil - Fixed Responsive Size */}
            <div className="relative w-[80%] h-[75%] max-w-[500px] max-h-[400px] border-2 border-dashed border-white/40 rounded-xl flex items-start justify-start p-4 transition-all duration-300 pointer-events-none z-10">
              <span className="font-mono text-[10px] text-neutral-300 tracking-widest uppercase bg-neutral-950/80 backdrop-blur px-3 py-1.5 rounded-md shadow border border-white/10">
                align product here
              </span>
            </div>

            {/* Hardware Selection & Indicators Overlay */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-4 ring-red-500/20"></div>
              <span className="font-mono text-xs text-white uppercase tracking-widest bg-neutral-950/70 backdrop-blur px-2.5 py-1 rounded shadow-sm border border-white/10">Live Stream</span>
            </div>

            <div className="absolute top-6 right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <select
                className="bg-neutral-950/80 backdrop-blur-md border border-white/20 text-neutral-200 text-[10px] uppercase font-mono px-4 py-2 rounded-md outline-none cursor-pointer hover:border-white/40 hover:bg-neutral-900/90 transition-colors shadow-lg"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
              >
                {cameras.length === 0 && <option value="">Detecting Cameras...</option>}
                {cameras.map(cam => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera Device ${cam.deviceId.substring(0, 4)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Defect Gallery (Audit Log) */}
          <div className="shrink-0 h-44 border border-white/5 rounded-xl bg-[#111111] p-5 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest">Defect Gallery (Live Log)</h2>
              <span className="font-mono text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">4 New</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {recentDefects.map((defect) => (
                <div key={defect.id} className="min-w-[140px] h-24 bg-neutral-900 border border-rose-500/20 rounded-lg relative group cursor-pointer hover:border-rose-500/50 transition-colors">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.05] to-transparent pointer-events-none"></div>
                  {/* Placeholder for defect crop */}
                  <div className="absolute top-2 left-2 right-2 bottom-8 border border-dashed border-rose-500/30 rounded flex items-center justify-center bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors">
                    <ImageIcon className="w-5 h-5 text-rose-500/40" />
                  </div>
                  {/* Details */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center px-1">
                    <span className="font-mono text-[10px] text-rose-400 capitalize">{defect.type}</span>
                    <span className="font-mono text-[10px] text-neutral-500">{defect.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column (Telemetry Panel) */}
        <section className="w-[30%] flex flex-col bg-neutral-950 overflow-y-auto border-l border-white/10">
          {/* Active Profile */}
          <div className="p-6 sm:p-8 border-b border-white/10 shrink-0">
            <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-2">Active Profile</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
              <p className="text-neutral-200 font-medium text-sm tracking-wide">alpha bracket v2</p>
            </div>
          </div>

          {/* Verdict Box */}
          <div className="flex flex-col p-6 sm:p-8 border-b border-white/10 relative shrink-0 min-h-[300px]">
            <div className="w-full flex justify-end gap-2 absolute top-6 right-8 z-10">
              {/* Toggles for Demo */}
              <button onClick={() => setVerdictStatus('idle')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'idle' ? 'bg-neutral-400 ring-2 ring-white/20' : 'bg-neutral-800 hover:bg-neutral-600'}`} title="Idle"></button>
              <button onClick={() => setVerdictStatus('pass')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'pass' ? 'bg-emerald-500 ring-2 ring-emerald-500/50' : 'bg-emerald-900/40 hover:bg-emerald-700/60'}`} title="Pass"></button>
              <button onClick={() => setVerdictStatus('fail')} className={`w-2 h-2 rounded-full transition-colors ${verdictStatus === 'fail' ? 'bg-rose-500 ring-2 ring-rose-500/50' : 'bg-rose-900/40 hover:bg-rose-700/60'}`} title="Fail"></button>
            </div>

            {verdictStatus === 'idle' && (
              <div className="w-full h-full flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#111111] transition-all duration-700 ease-in-out relative overflow-hidden group">
                <Loader2 className="w-8 h-8 text-neutral-600 animate-spin mb-6" />
                <h3 className="font-serif text-3xl sm:text-4xl text-neutral-500 lowercase tracking-wide">awaiting scan...</h3>
              </div>
            )}

            {verdictStatus === 'pass' && (
              <div className="w-full h-full flex-1 flex flex-col items-center justify-center rounded-2xl bg-emerald-500 text-neutral-950 shadow-[0_0_80px_rgba(16,185,129,0.15)] transition-all duration-700 ease-in-out relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent pointer-events-none"></div>
                <CheckCircle2 className="w-14 h-14 mb-6 opacity-90 stroke-[1.5]" />
                <h3 className="font-serif text-5xl sm:text-6xl text-neutral-950 tracking-tight lowercase">pass</h3>
                <div className="mt-8 px-4 py-1.5 bg-neutral-950/10 rounded-full">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-80 font-semibold">Quality Verified</span>
                </div>
              </div>
            )}

            {verdictStatus === 'fail' && (
              <div className="w-full h-full flex-1 flex flex-col items-center justify-center rounded-2xl bg-red-500 text-neutral-50 shadow-[0_0_80px_rgba(239,68,68,0.15)] transition-all duration-700 ease-in-out relative overflow-hidden">
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
          <div className="p-6 sm:p-8 border-b border-white/10 shrink-0">
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

          {/* Data Visualization */}
          <div className="p-6 sm:p-8 flex flex-col gap-8 shrink-0 pb-12">
            {/* Yield Sparkline */}
            <div>
              <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-4">Live Yield Trend (1hr)</h2>
              <div className="h-32 w-full bg-[#111111] rounded-xl border border-white/5 p-4 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yieldData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin - 1', 100]} hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#262626', borderRadius: '8px', color: '#a3a3a3' }}
                      itemStyle={{ color: '#10b981' }}
                      labelStyle={{ display: 'none' }}
                      formatter={(value) => [`${value}% yield`, '']}
                    />
                    <Area type="monotone" dataKey="yield" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorYield)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Defect Categorization */}
            <div>
              <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest mb-4">Defect Breakdown</h2>
              <div className="flex items-center bg-[#111111] rounded-xl border border-white/5 p-4">
                <div className="w-24 h-24 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={defectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={42}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {defectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-mono text-xs text-neutral-300">4</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="ml-6 flex flex-col gap-3 flex-1">
                  {defectData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }}></div>
                        <span className="text-xs text-neutral-400 capitalize">{item.name}</span>
                      </div>
                      <span className="font-mono text-xs text-neutral-200">{item.value}%</span>
                    </div>
                  ))}
                </div>
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
                <div className="flex items-center justify-between mb-3">
                  <label className="block font-mono text-[10px] uppercase text-neutral-500 tracking-widest">
                    Baseline Images (Max 10)
                  </label>
                  {calibrationImages.length > 0 && (
                    <label className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-neutral-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2">
                      <UploadCloud size={14} />
                      <span>Upload More</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                {calibrationImages.length === 0 ? (
                  <label className="w-full h-56 bg-[#111111] rounded-xl border border-white/5 flex flex-col items-center justify-center text-neutral-600 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-colors">
                    <UploadCloud size={32} className="mb-4 opacity-40 group-hover:opacity-80 transition-opacity text-neutral-400" strokeWidth={1.5} />
                    <span className="font-mono text-sm opacity-90 text-neutral-300 mb-1">Click to Upload Images</span>
                    <span className="font-mono text-[10px] opacity-60">Upload up to 10 baseline frames</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <div className="w-full h-56 bg-[#111111] rounded-xl border border-white/5 p-4 overflow-y-auto grid grid-cols-3 gap-3 custom-scrollbar content-start">
                    {calibrationImages.map((src, i) => (
                      <div key={i} className="aspect-square bg-neutral-900 rounded-lg relative group overflow-hidden border border-white/5">
                        <img src={src} alt="calibration" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        <button
                          onClick={() => setCalibrationImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-neutral-950/80 p-1.5 rounded-full text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {calibrationImages.length < 10 && (
                      <label className="aspect-square bg-neutral-900 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors">
                        <UploadCloud size={20} className="text-neutral-500 mb-2" />
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">Add More</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                )}
                {calibrationImages.length > 0 && (
                  <p className="text-right font-mono text-[10px] text-neutral-500 mt-2">{calibrationImages.length} of 10 uploaded</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTrainModel}
                  disabled={calibrationImages.length === 0 || isTraining}
                  className="w-full flex items-center justify-center gap-2 bg-white text-neutral-950 font-medium tracking-wide py-4.5 rounded-xl hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTraining && <Loader2 size={18} className="animate-spin text-neutral-600" />}
                  {isTraining 
                    ? 'calibrating model...' 
                    : (calibrationImages.length > 0 ? `train with ${calibrationImages.length} images` : 'upload images to train')
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm transition-opacity" onClick={() => setShowSummaryModal(false)}></div>
          <div className="relative w-full max-w-[600px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-8 transform scale-100 transition-transform">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-3xl text-neutral-200 lowercase">shift summary</h2>
              <button onClick={() => setShowSummaryModal(false)} className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 border-b border-white/10 pb-8">
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Total Scanned</p>
                <div className="font-mono text-3xl text-neutral-200">142</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Final Yield</p>
                <div className="font-mono text-3xl text-emerald-500/90">97.1%</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Total Defects</p>
                <div className="font-mono text-3xl text-rose-500/90">4</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Top Offender</p>
                <div className="font-mono text-xl text-amber-500/90 mt-2">Scratches</div>
              </div>
            </div>

            <p className="text-neutral-400 text-sm mb-6">The shift has been paused. You can download the full CSV export of all timestamped scan events and anomalies for your QA records.</p>

            <button
              onClick={exportCSV}
              className="w-full flex items-center justify-center gap-3 bg-white text-neutral-950 font-medium tracking-wide py-4.5 rounded-xl hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer"
            >
              <Download size={18} />
              <span>Download Shift Export (CSV)</span>
            </button>

            <button
              onClick={() => {
                setShowSummaryModal(false);
                setIsShiftActive(true);
              }}
              className="w-full mt-6 text-center text-xs text-neutral-500 font-mono hover:text-neutral-300 transition-colors uppercase tracking-widest cursor-pointer"
            >
              Return to Shift (Resume)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
