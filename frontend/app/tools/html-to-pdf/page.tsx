"use client";
import { useState, useRef } from "react";

// --- CẤU HÌNH API ---
// - Local: Đọc từ .env.local (http://localhost:8000)
// - Production: Rỗng "" (để Nginx tự điều hướng)
const API_BASE = "";

export default function HtmlToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPdfUrl(null);
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/v1/html-to-pdf/convert`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        const errorText = await res.text();
        alert(`Lỗi chuyển đổi: ${errorText}`);
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối Server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-teal-600">
              HTML to Infinite PDF
            </span>
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* UPLOAD AREA */}
        {!file && (
            <div className="flex flex-col items-center justify-center mt-20 animate-in fade-in slide-in-from-bottom-4">
            <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-2xl h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-white flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all"
            >
                <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={handleFileSelect}
                />
                <p className="font-medium text-lg text-slate-600">
                Click để tải lên file HTML
                </p>
                <p className="text-sm text-slate-400 mt-2">
                Hỗ trợ file .html, .htm
                </p>
            </div>
            </div>
        )}

        {/* TOOLBAR */}
        {file && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded text-green-600 flex items-center justify-center font-bold text-xs">
                HTML
                </div>
                <div>
                <p className="font-semibold line-clamp-1">{file.name}</p>
                <button
                    onClick={() => {
                        setFile(null);
                        setPdfUrl(null);
                    }}
                    className="text-xs text-red-500 hover:underline"
                >
                    Xóa / Chọn lại
                </button>
                </div>
            </div>

            <button
                onClick={handleConvert}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-green-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
                {loading ? (
                <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    Đang chuyển đổi...
                </>
                ) : (
                <>🚀 Chuyển đổi sang PDF</>
                )}
            </button>
            </div>
        )}

        {/* RESULTS */}
        {pdfUrl && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">Kết quả Preview (PDF)</h2>
                    <a
                        href={pdfUrl}
                        download={`${file?.name.replace(/\.[^/.]+$/, "")}_infinite.pdf`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                    >
                        📥 Tải PDF về máy
                    </a>
                </div>
                
                <div className="h-[85vh] bg-white rounded-xl shadow border overflow-hidden">
                    <iframe
                        src={`${pdfUrl}#toolbar=0&navpanes=0`}
                        className="w-full h-full"
                        title="PDF Preview"
                    />
                </div>
            </div>
        )}

      </main>
    </div>
  );
}
