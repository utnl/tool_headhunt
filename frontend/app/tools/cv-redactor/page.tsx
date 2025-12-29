"use client";
import { useState, useRef } from "react";

// --- CẤU HÌNH API URL ---
// Lấy từ biến môi trường, nếu không có thì mặc định là localhost:8000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Box = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export default function CvRedactorPage() {
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("auto");
  const [file, setFile] = useState<File | null>(null);
  
  // State chung
  const [loading, setLoading] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null);

  // State Manual Mode
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [pickedColor, setPickedColor] = useState("#ffffff");
  const [isSnapping, setIsSnapping] = useState(true);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. LOGIC HÚT MÀU (EYE DROPPER) ---
  const handleEyeDropper = async () => {
    if (!("EyeDropper" in window)) {
      alert("Trình duyệt này chưa hỗ trợ hút màu. Hãy dùng Chrome hoặc Edge nhé!");
      return;
    }
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      setPickedColor(result.sRGBHex);
    } catch (e) {
      console.log("Đã hủy hút màu");
    }
  };

  // --- CÁC HÀM XỬ LÝ ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setOriginalPdfUrl(URL.createObjectURL(selectedFile));
      setResultPdfUrl(null);
      setBoxes([]);
      if (activeTab === "manual") fetchPreview(selectedFile);
    }
  };

  const fetchPreview = async (f: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", f);
    try {
      // ✅ SỬ DỤNG API_BASE THAY VÌ LOCALHOST
      const res = await fetch(`${API_BASE}/api/v1/cv/preview`, {
        method: "POST", body: formData,
      });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewImgUrl(window.URL.createObjectURL(blob));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const switchToManual = () => {
    if (!file) return;
    setActiveTab("manual");
    setResultPdfUrl(null);
    fetchPreview(file);
  };

  const getMousePos = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!previewImgUrl) return;
    setIsDrawing(true);
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentBox({ id: Date.now(), x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentBox) return;
    const pos = getMousePos(e);
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;
    setCurrentBox({
      ...currentBox, w: Math.abs(w), h: Math.abs(h),
      x: w < 0 ? pos.x : startPos.x, y: h < 0 ? pos.y : startPos.y,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.w > 5 && currentBox.h > 5) {
      setBoxes([...boxes, currentBox]);
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  const removeBox = (id: number) => {
    setBoxes(boxes.filter((b) => b.id !== id));
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    // ✅ SỬ DỤNG API_BASE THAY VÌ LOCALHOST
    let endpoint = `${API_BASE}/api/v1/cv/redact`;

    if (activeTab === "manual") {
      endpoint = `${API_BASE}/api/v1/cv/redact-manual`;
      const imageWidth = imgRef.current?.clientWidth || 0;
      const boxesData = boxes.map(b => ({ ...b, imageWidth }));
      
      formData.append("boxes", JSON.stringify(boxesData));
      formData.append("color", pickedColor);
      formData.append("snapping", isSnapping.toString());
    }

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (res.ok) {
        const blob = await res.blob();
        setResultPdfUrl(window.URL.createObjectURL(blob));
      } else {
        alert("Lỗi xử lý! Vui lòng kiểm tra lại Backend.");
      }
    } catch (e) { 
        alert(`Không thể kết nối đến server: ${API_BASE}`); 
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🛡️</span> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">CV Redactor Pro</span>
          </h1>
          <div className="bg-slate-100 p-1 rounded-lg hidden md:flex">
             <button onClick={() => { setActiveTab("auto"); setResultPdfUrl(null); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "auto" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}> 🤖 Tự động</button>
             <button onClick={switchToManual} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "manual" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}> 🖐️ Thủ công</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        
        {/* UPLOAD & CONTROLS */}
        {!file && (
           <div className="flex flex-col items-center justify-center mt-20 animate-in fade-in slide-in-from-bottom-4">
             <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-2xl h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-white flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
               <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
               <p className="font-medium text-lg">Tải lên CV PDF để bắt đầu</p>
             </div>
           </div>
        )}

        {file && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-red-100 rounded text-red-600 flex items-center justify-center font-bold text-xs">PDF</div>
               <div><p className="font-semibold">{file.name}</p><button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline">Xóa / Chọn lại</button></div>
            </div>
            <div className="flex gap-3">
               <button onClick={handleProcess} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-50">
                 {loading ? "Đang xử lý..." : activeTab === "auto" ? "🚀 Bắt đầu Che (Auto)" : "🔥 Xóa vùng đã chọn"}
               </button>
            </div>
          </div>
        )}

        {/* WORKSPACE MANUAL */}
        {activeTab === "manual" && previewImgUrl && !resultPdfUrl && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in zoom-in-95">
              {/* Toolbar */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit space-y-6">
                <div>
                   <label className="block text-sm font-semibold mb-2">Màu che</label>
                   
                   {/* 🖊️ NÚT HÚT MÀU */}
                   <div className="flex gap-2 mb-2">
                      <button 
                        onClick={handleEyeDropper}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 border border-slate-300 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        Hút màu
                      </button>
                   </div>

                   <div className="flex items-center gap-2 border rounded p-1 bg-slate-50">
                     <input type="color" value={pickedColor} onChange={(e) => setPickedColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-none bg-transparent" />
                     <span className="text-sm text-slate-600 font-mono">{pickedColor}</span>
                   </div>
                </div>
                
                <div>
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input type="checkbox" checked={isSnapping} onChange={(e) => setIsSnapping(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                     <span className="text-sm font-medium">Chế độ Hít chữ (Snapping)</span>
                   </label>
                   <p className="text-xs text-slate-500 mt-1 pl-6">Vùng vẽ sẽ tự động ôm vào chữ gần nhất.</p>
                </div>

                <div className="pt-4 border-t">
                  <button onClick={() => setBoxes([])} className="w-full text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded text-sm font-medium">Xóa hết vùng vẽ</button>
                </div>
              </div>

              {/* Canvas */}
              <div className="lg:col-span-3 bg-slate-200 rounded-xl overflow-auto p-4 flex justify-center border-2 border-dashed border-slate-300">
                <div 
                  ref={containerRef}
                  className="relative cursor-crosshair shadow-xl inline-block"
                  onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                >
                  <img ref={imgRef} src={previewImgUrl} alt="PDF Preview" className="max-w-full pointer-events-none select-none block" draggable={false} />
                  {boxes.map((box) => (
                    <div key={box.id} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, backgroundColor: pickedColor, opacity: 0.7, border: "1px solid rgba(0,0,0,0.2)" }} className="group">
                      <button onClick={(e) => { e.stopPropagation(); removeBox(box.id); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                  {currentBox && (
                    <div style={{ position: "absolute", left: currentBox.x, top: currentBox.y, width: currentBox.w, height: currentBox.h, backgroundColor: "rgba(255, 0, 0, 0.2)", border: "2px dashed red" }} />
                  )}
                </div>
              </div>
           </div>
        )}

        {/* 2. HIỂN THỊ KẾT QUẢ (Auto & Manual) */}
        {resultPdfUrl && (
           <div className="animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                   <div className="bg-green-100 p-2 rounded-full text-green-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                   <div><h3 className="font-bold text-green-800">Xử lý thành công!</h3><p className="text-sm text-green-600">Đã áp dụng che thông tin.</p></div>
                </div>
                <div className="flex gap-3">
                   <a href={resultPdfUrl} download={`redacted_${file?.name}`} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium shadow-md shadow-green-200 flex items-center gap-2">📥 Tải xuống PDF</a>
                   {activeTab === "auto" && <button onClick={switchToManual} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2">🛠️ Chưa ưng ý? Sửa thủ công</button>}
                   {activeTab === "manual" && <button onClick={() => setResultPdfUrl(null)} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-lg font-medium shadow-sm">✏️ Vẽ thêm / Sửa lại</button>}
                </div>
             </div>
             {activeTab === "auto" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[75vh]">
                   <div className="bg-white rounded-xl shadow border overflow-hidden flex flex-col"><div className="bg-slate-50 p-3 border-b text-xs font-bold text-slate-500 uppercase">Bản gốc</div>{originalPdfUrl && <iframe src={`${originalPdfUrl}#toolbar=0`} className="w-full h-full" />}</div>
                   <div className="bg-white rounded-xl shadow border overflow-hidden flex flex-col"><div className="bg-blue-50 p-3 border-b text-xs font-bold text-blue-600 uppercase">Kết quả tự động</div><iframe src={`${resultPdfUrl}#toolbar=0`} className="w-full h-full" /></div>
                </div>
             ) : (
                <div className="h-[80vh] bg-white rounded-xl shadow border overflow-hidden"><iframe src={resultPdfUrl} className="w-full h-full" /></div>
             )}
           </div>
        )}
      </main>
    </div>
  );
}