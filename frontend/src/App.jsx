import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Camera, CheckCircle2, AlertTriangle, Loader2, UploadCloud, ImageIcon, PauseCircle, PlayCircle, Power, Download } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { api } from './services/api'; // Make sure the path matches where you put api.js

const defectData = [
  { name: 'Scratches', value: 45, fill: '#ef4444' }, // rose-500
  { name: 'Misalignment', value: 30, fill: '#f59e0b' }, // amber-500
  { name: 'Dimensional', value: 25, fill: '#8b5cf6' }, // violet-500
];


export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(true);
  const [isTraining, setIsTraining] = useState(false);

  // App States
  const [verdictStatus, setVerdictStatus] = useState('idle'); // 'idle', 'pass', 'fail'
  const [calibrationImages, setCalibrationImages] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [heatmapOverlay, setHeatmapOverlay] = useState(null);
  const [userThreshold, setUserThreshold] = useState(40.0);

  const [liveStats, setLiveStats] = useState({
    total_scanned: 0,
    passed: 0,
    failed: 0,
    defect_rate: 0
  });

  const [recentDefects, setRecentDefects] = useState([]);
  const [yieldTrend, setYieldTrend] = useState([{ time: '00:00', yield: 100.0 }]);

  // Test Gallery States
  const [testImages, setTestImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInspecting, setIsInspecting] = useState(false);

  const isShiftActiveRef = useRef(true);
  const verdictTimeoutRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    isShiftActiveRef.current = isShiftActive;
  }, [isShiftActive]);

  // Handle uploading multiple test images
  const handleTestImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    // Convert files to base64
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    try {
      const newImages = await Promise.all(files.map(fileToBase64));

      const newTestObjects = newImages.map(img => ({
        original_base64: img,
        heatmap_base64: null,
        is_defective: null,
        confidence: null,
        status: 'pending' // pending, pass, fail
      }));

      setTestImages(prev => [...prev, ...newTestObjects]);
      if (testImages.length === 0) setCurrentIndex(0); // Jump to first new image
    } catch (err) {
      console.error("Error reading files:", err);
      alert("Failed to read image files.");
    }
  };

  // Inspect the currently selected image
  const runInspectionOnCurrent = async () => {
    if (testImages.length === 0 || !testImages[currentIndex]) return;

    setIsInspecting(true);
    const currentImg = testImages[currentIndex];

    try {
      const data = await api.inspectImage({
        image_base64: currentImg.original_base64,
        threshold: userThreshold
      });

      // Update the specific image with inference metadata
      setTestImages(prev => {
        const copy = [...prev];
        copy[currentIndex] = {
          ...copy[currentIndex],
          heatmap_base64: data.heatmap_base64,
          is_defective: data.confidence > userThreshold,
          confidence: data.confidence,
          status: data.confidence > userThreshold ? 'fail' : 'pass'
        };
        return copy;
      });

      // Update overarching UI States
      setVerdictStatus(data.confidence > userThreshold ? 'fail' : 'pass');
      if (data.heatmap_base64) {
        const mapSrc = data.heatmap_base64.startsWith('data:image')
          ? data.heatmap_base64
          : `data:image/jpeg;base64,${data.heatmap_base64}`;
        setHeatmapOverlay(mapSrc);
      } else {
        setHeatmapOverlay(null);
      }

      if (data.confidence > userThreshold) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setRecentDefects(prev => [{ id: `def-${Date.now()}`, time: timeStr, type: data.product_drift ? 'Drift/Swap' : 'Defect', img: currentImg.original_base64 }, ...prev]);
      }

      // Fetch the updated latest stats from backend (since inspect natively increments them)
      api.getSystemStats().then(stats => setLiveStats(stats)).catch(() => { });

      // TWIST 2: Detect Product Drift mid-shift
      if (data.product_drift) {
        alert("PRODUCT DRIFT DETECTED: The item structurally mismatches the active Profile reference batch.\\n\\nProduction Line sequence halted. Please supply a new Golden Reference calibration batch.");
        setIsModalOpen(true);
      }

    } catch (error) {
      console.error("Inspection error:", error);
      alert(error.message || "Failed to inspect image");
    } finally {
      setIsInspecting(false);
    }
  };

  // When changing selected image, reset visual overlays
  useEffect(() => {
    if (testImages[currentIndex]) {
      const imgData = testImages[currentIndex];

      if (imgData.status === 'pending') {
        setVerdictStatus('idle');
        setHeatmapOverlay(null);
      } else {
        setVerdictStatus(imgData.status);
        if (imgData.heatmap_base64) {
          const mapSrc = imgData.heatmap_base64.startsWith('data:image')
            ? imgData.heatmap_base64
            : `data:image/jpeg;base64,${imgData.heatmap_base64}`;
          setHeatmapOverlay(mapSrc);
        } else {
          setHeatmapOverlay(null);
        }
      }
    }
  }, [currentIndex, testImages]);
  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const data = await api.getSystemStats();
        setLiveStats(data);

        // Dynamic Live Yield update
        const currentYield = data.total_scanned === 0 ? 100.0 : +((100.0 - data.defect_rate).toFixed(1));
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setYieldTrend(prev => {
          const newTrend = [...prev, { time: timeStr, yield: currentYield }];
          return newTrend.slice(-20); // Keep last 20 frames
        });
      } catch (err) {
        // Silently fail if backend is restarting
      }
    };

    // Fetch immediately on load, then every 2 seconds
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    // Convert files to base64
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    try {
      const newImages = await Promise.all(files.map(fileToBase64));
      setCalibrationImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error("Error reading files:", err);
      alert("Failed to read image files.");
    }
  };

  const handleTrainModel = async () => {
    if (!profileName.trim()) {
      alert("Please enter a product name first.");
      return;
    }
    if (calibrationImages.length === 0) {
      alert("Please upload or capture baseline images first.");
      return;
    }
    setIsTraining(true);

    try {
      await api.calibrateModel({
        name: profileName,
        images_base64: calibrationImages
      });

      setIsTraining(false);
      setIsModalOpen(false); // Close calibration modal
      setCalibrationImages([]); // Reset images
      setProfileName(''); // Reset profile name
      alert('Model successfully calibrated to the new baseline images!');
    } catch (error) {
      console.error('Calibration failed:', error);
      alert('Failed to calibrate model: ' + error.message);
      setIsTraining(false);
    }
  };

  const handleCaptureFromStream = () => {
    if (calibrationImages.length >= 10) {
      alert("Maximum 10 baseline images allowed.");
      return;
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Keep dimensions identical to live inference stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Frame = canvas.toDataURL('image/jpeg', 0.8);
        setCalibrationImages(prev => [...prev, base64Frame].slice(0, 10));
      } else {
        alert("Camera feed not ready.");
      }
    }
  };

  const handleEndShift = () => {
    setIsShiftActive(false);
    setShowSummaryModal(true);
  };

  const exportCSV = () => {
    const headers = "Time,Defect Type,ID\n";
    const rows = recentDefects.map(d => `${d.time},${d.type},${d.id}`).join("\n");
    const csvContent = headers + rows;

    // Create strong blob instead of fragile Data URI encoding
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const testConnection = async () => {
    try {
      const data = await api.getSystemStats();
      console.log("🟢 BACKEND SAYS:", data);
      alert("CONNECTION SECURED! 🚀 Check console.");
    } catch (error) {
      console.error("🔴 CONNECTION FAILED:", error);
      alert("BACKEND IS GHOSTING US 👻 Check console.");
    }
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
            onClick={testConnection}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-mono text-blue-400 hover:text-blue-200 hover:bg-blue-500/10 rounded-md transition-colors duration-200 cursor-pointer border border-blue-500/20"
          >
            <span>ping backend 🔌</span>
          </button>
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
          <div className="flex-1 bg-[#111111] rounded-xl relative overflow-hidden flex flex-col items-center justify-center border border-white/5 shadow-2xl mb-6 bg-neutral-900 group">

            {!liveStats.active_profile ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-transparent">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                  <Settings size={28} className="text-neutral-400 opacity-80 animate-[spin_4s_linear_infinite]" />
                </div>
                <span className="font-mono text-xl opacity-90 text-neutral-200 mb-3 tracking-wide">Device Uncalibrated</span>
                <span className="font-mono text-xs opacity-60 text-neutral-400 max-w-sm leading-relaxed mb-8">
                  To ensure measurement fidelity, the inspection module requires a Golden Reference baseline before processing external data.
                </span>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-mono text-[10px] uppercase tracking-widest rounded-md transition-colors border border-blue-500/30"
                >
                  Open Calibration Matrix
                </button>
              </div>
            ) : testImages.length === 0 ? (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                <UploadCloud size={48} className="mb-6 opacity-30 text-neutral-400" />
                <span className="font-mono text-lg opacity-90 text-neutral-300 mb-2">Upload Test Images</span>
                <span className="font-mono text-xs opacity-50 text-neutral-500">Supports batch upload.</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleTestImageUpload} />
              </label>
            ) : (
              <div className="w-full h-full flex flex-col">
                {/* Image Viewer */}
                <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden p-8">
                  {testImages[currentIndex] && (
                    <div className="relative max-w-full max-h-full">
                      {heatmapOverlay ? (
                        <img
                          src={heatmapOverlay}
                          alt="Defect Heatmap"
                          className="max-w-full max-h-full object-contain rounded-md"
                        />
                      ) : (
                        <img
                          src={testImages[currentIndex].original_base64}
                          className="max-w-full max-h-full object-contain rounded-md"
                          alt="Test View"
                        />
                      )}
                    </div>
                  )}

                  {/* Overlay Navigation */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-between p-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(Math.max(0, currentIndex - 1)); }}
                      disabled={currentIndex === 0}
                      className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-neutral-950/80 text-white disabled:opacity-20 hover:bg-neutral-800 transition-colors"
                    >
                      ←
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(Math.min(testImages.length - 1, currentIndex + 1)); }}
                      disabled={currentIndex === testImages.length - 1}
                      className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-neutral-950/80 text-white disabled:opacity-20 hover:bg-neutral-800 transition-colors"
                    >
                      →
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="h-20 border-t border-white/10 bg-neutral-950 px-6 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-neutral-400">
                      Image {currentIndex + 1} of {testImages.length}
                    </span>
                    {testImages[currentIndex]?.status !== 'pending' && testImages[currentIndex]?.confidence != null && (
                      <span className="font-mono text-xs px-2 py-1 bg-[#111] border border-white/10 rounded-md text-amber-500/90 shadow-inner">
                        RAW SCORE: {testImages[currentIndex].confidence.toFixed(3)}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <label className="cursor-pointer px-4 py-2 border border-white/20 rounded text-neutral-300 font-mono text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center">
                      Upload More
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleTestImageUpload} />
                    </label>
                    <button
                      onClick={runInspectionOnCurrent}
                      disabled={isInspecting || testImages[currentIndex]?.status !== 'pending'}
                      className="px-6 py-2 bg-blue-600 disabled:opacity-50 hover:bg-blue-500 rounded text-white font-mono text-[10px] uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/20"
                    >
                      {isInspecting ? 'Inspecting...' : (testImages[currentIndex]?.status !== 'pending' ? 'Already Inspected' : 'Run Inspection')}
                    </button>

                    {/* TWIST 1 Button */}
                    {testImages[currentIndex]?.status === 'fail' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.adaptModel({ image_base64: testImages[currentIndex].original_base64, threshold: userThreshold });
                            alert("Variation Accepted! The model is adapting in the background and will recognize this pattern automatically going forward.");

                            const newImages = [...testImages];
                            newImages[currentIndex].status = 'pass';
                            newImages[currentIndex].heatmap_base64 = null;
                            setTestImages(newImages);
                            setVerdictStatus('pass');
                            setHeatmapOverlay(null);
                          } catch (e) {
                            alert("Failed to queue adaptation: " + e.message);
                          }
                        }}
                        className="px-6 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/50 rounded font-mono text-[10px] uppercase tracking-widest transition-colors shadow-lg"
                      >
                        Accept As Normal
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Defect Gallery (Audit Log) */}
          <div className="shrink-0 h-44 border border-white/5 rounded-xl bg-[#111111] p-5 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-[10px] uppercase text-neutral-500 tracking-widest">Defect Gallery (Live Log)</h2>
              <span className="font-mono text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full"></span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {recentDefects.map((defect) => (
                <div key={defect.id} className="min-w-[140px] h-24 bg-neutral-900 border border-rose-500/20 rounded-lg relative group cursor-pointer hover:border-rose-500/50 transition-colors">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.05] to-transparent pointer-events-none"></div>
                  {/* Defect crop thumbnail */}
                  <div className="absolute top-2 left-2 right-2 bottom-8 rounded overflow-hidden flex items-center justify-center bg-neutral-900 border border-white/5">
                    <img src={defect.img} alt="Defect" className="w-full h-full object-cover" />
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
              <p className="text-neutral-200 font-medium text-sm tracking-wide">{liveStats.active_profile || 'No Profile Loaded'}</p>
            </div>
          </div>

          {/* Verdict Box */}
          <div className="flex flex-col p-6 sm:p-8 border-b border-white/10 relative shrink-0 min-h-[300px]">
            {/* Threshold Slider */}
            <div className="absolute top-4 left-6 z-10 hidden sm:flex flex-col w-32 border border-white/10 p-2 rounded-md bg-[#0A0A0A]">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-mono uppercase text-neutral-500">Threshold</span>
                <span className="text-[9px] font-mono text-amber-500">{userThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="150.0"
                step="0.5"
                value={userThreshold}
                onChange={(e) => {
                  const newT = parseFloat(e.target.value);
                  setUserThreshold(newT);
                  // Dynamically update active image verdict
                  if (testImages[currentIndex] && testImages[currentIndex].status !== 'pending') {
                    const conf = testImages[currentIndex].confidence;
                    const newStat = conf > newT ? 'fail' : 'pass';
                    setVerdictStatus(newStat);
                  }
                }}
                className="w-full accent-amber-500 h-1 bg-white/10 rounded-full appearance-none outline-none"
              />
            </div>

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
                <div className="font-mono text-3xl text-neutral-200 font-light">{liveStats.total_scanned}</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">yield rate</p>
                <div className="font-mono text-3xl text-neutral-200 font-light">
                  {liveStats.total_scanned === 0 ? "100.0" : (100 - liveStats.defect_rate).toFixed(1)}%
                </div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">passed</p>
                <div className="font-mono text-3xl text-emerald-500/90 font-light">{liveStats.passed}</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2">failed</p>
                <div className="font-mono text-3xl text-rose-500/90 font-light">{liveStats.failed}</div>
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
                  <AreaChart data={yieldTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3.5 text-neutral-200 font-sans text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-neutral-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block font-mono text-[10px] uppercase text-neutral-500 tracking-widest">
                    Baseline Images (Any Amount)
                  </label>
                  {calibrationImages.length > 0 && (
                    <div className="flex gap-2">
                      <label className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-neutral-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2">
                        <UploadCloud size={14} />
                        <span>Upload</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    </div>
                  )}
                </div>

                {calibrationImages.length === 0 ? (
                  <div className="w-full">
                    <label className="h-56 bg-[#111111] rounded-xl border border-white/5 flex flex-col items-center justify-center text-neutral-600 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-colors">
                      <UploadCloud size={32} className="mb-4 opacity-40 group-hover:opacity-80 transition-opacity text-neutral-400" strokeWidth={1.5} />
                      <span className="font-mono text-[11px] opacity-90 text-neutral-300 mb-1">Upload Local</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
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
                  <p className="text-right font-mono text-[10px] text-neutral-500 mt-2">{calibrationImages.length} uploaded</p>
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
                <div className="font-mono text-3xl text-neutral-200">{liveStats.total_scanned}</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Final Yield</p>
                <div className="font-mono text-3xl text-emerald-500/90">
                  {liveStats.total_scanned === 0 ? "100.0" : (100 - liveStats.defect_rate).toFixed(1)}%
                </div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Total Defects</p>
                <div className="font-mono text-3xl text-rose-500/90">{liveStats.failed}</div>
              </div>
              <div>
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Top Offender</p>
                <div className="font-mono text-xl text-amber-500/90 mt-2">{liveStats.failed > 0 ? "Detected Error" : "None"}</div>
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
