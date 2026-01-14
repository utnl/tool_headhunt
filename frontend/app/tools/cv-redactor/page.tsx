"use client";
import { useState, useRef, useEffect } from "react";

// --- CẤU HÌNH API ---
// - Local: Đọc từ .env.local (http://localhost:8000)
// - Production: Rỗng "" (để Nginx tự điều hướng)
const API_BASE =  "";

type Box = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pageIndex: number; // Xác định hộp vẽ thuộc trang nào
};

export default function CvRedactorPage() {
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("auto");
  const [file, setFile] = useState<File | null>(null);

  // State hiển thị
  const [loading, setLoading] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null);
  const [cloudinaryUrl, setCloudinaryUrl] = useState<string | null>(null); // URL lưu trên Cloudinary

  // State Manual Mode
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const [totalPages, setTotalPages] = useState(0);

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [pickedColor, setPickedColor] = useState("#ffffff");
  const [isSnapping, setIsSnapping] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. CÔNG CỤ HÚT MÀU ---
  const handleEyeDropper = async () => {
    if (!("EyeDropper" in window)) {
      alert(
        "Trình duyệt không hỗ trợ hút màu (Dùng Chrome/Edge trên máy tính)"
      );
      return;
    }
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      setPickedColor(result.sRGBHex);
    } catch (e) {
      // Người dùng hủy hút màu
    }
  };

  // --- 2. UPLOAD LÊN CLOUDINARY ---
  const uploadToCloudinary = async (f: File) => {
    const formData = new FormData();
    formData.append("file", f);
    try {
      const res = await fetch(`${API_BASE}/api/v1/upload/cv`, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setCloudinaryUrl(data.url);
        console.log("✅ Uploaded to Cloudinary:", data.url);
        return data;
      }
    } catch (e) {
      console.error("Lỗi upload Cloudinary:", e);
    }
    return null;
  };

  // --- 3. XỬ LÝ FILE ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setOriginalPdfUrl(URL.createObjectURL(selectedFile));
      setResultPdfUrl(null);
      setCloudinaryUrl(null);
      setBoxes([]);
      setPreviewUrls({});
      setTotalPages(0);
      
      // Upload lên Cloudinary ngay khi chọn file
      uploadToCloudinary(selectedFile);
      
      // Lấy thông tin số trang
      await fetchPdfInfo(selectedFile);
    }
  };

  // --- 4. GỌI API ---
  const fetchPdfInfo = async (f: File) => {
    const formData = new FormData();
    formData.append("file", f);
    try {
      const res = await fetch(`${API_BASE}/api/v1/cv/info`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const pages = data.total_pages || 1;
        setTotalPages(pages);
      }
    } catch (e) {
      console.error("Lỗi lấy info:", e);
    }
  };

  const fetchAllPreviews = async (f: File, total: number) => {
    setLoading(true);
    const urls: Record<number, string> = {};

    // Tải ảnh từng trang
    for (let i = 0; i < total; i++) {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("page", i.toString());
      try {
        const res = await fetch(`${API_BASE}/api/v1/cv/preview`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const blob = await res.blob();
          urls[i] = window.URL.createObjectURL(blob);
        }
      } catch (e) {
        console.error(`Lỗi tải trang ${i}:`, e);
      }
    }
    setPreviewUrls(urls);
    setLoading(false);
  };

  const switchToManual = () => {
    if (!file) return;
    setActiveTab("manual");
    setResultPdfUrl(null);
    // Nếu chưa tải ảnh preview thì tải ngay
    if (Object.keys(previewUrls).length === 0) {
      fetchAllPreviews(file, totalPages || 1);
    }
  };

  // --- 4. LOGIC VẼ (Hỗ trợ đa trang & Scroll) ---
  const getRelativePos = (e: React.MouseEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, pageIndex: number) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getRelativePos(e, e.currentTarget as HTMLElement);
    setStartPos(pos);
    setCurrentBox({
      id: Date.now(),
      x: pos.x,
      y: pos.y,
      w: 0,
      h: 0,
      pageIndex,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentBox) return;

    const pos = getRelativePos(e, e.currentTarget as HTMLElement);
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;

    setCurrentBox({
      ...currentBox,
      w: Math.abs(w),
      h: Math.abs(h),
      x: w < 0 ? pos.x : startPos.x,
      y: h < 0 ? pos.y : startPos.y,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.w > 2 && currentBox.h > 2) {
      setBoxes([...boxes, currentBox]);
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  const removeBox = (id: number) => {
    setBoxes(boxes.filter((b) => b.id !== id));
  };

  // --- 5. GỬI XỬ LÝ (Auto & Manual) ---
  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    let endpoint = `${API_BASE}/api/v1/cv/redact`; // Auto

    if (activeTab === "manual") {
      endpoint = `${API_BASE}/api/v1/cv/redact-manual`;

      // Lấy chiều rộng hiển thị của ảnh trang đầu tiên để tính tỷ lệ Scale
      const firstImage = document.getElementById(
        "page-image-0"
      ) as HTMLImageElement;
      // Fallback 850 nếu chưa load xong
      const imageWidth = firstImage?.clientWidth || 850;

      // Gửi boxes kèm chiều rộng ảnh để Backend tính lại tọa độ
      const boxesData = boxes.map((b) => ({ ...b, imageWidth }));

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
        alert("Lỗi xử lý! Vui lòng thử lại.");
      }
    } catch (e) {
      alert("Lỗi kết nối Server. Vui lòng kiểm tra lại Backend.");
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
            <span className="text-2xl">🛡️</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              CV Redactor Pro
            </span>
          </h1>

          <div className="bg-slate-100 p-1 rounded-lg hidden md:flex">
            <button
              onClick={() => {
                setActiveTab("auto");
                setResultPdfUrl(null);
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "auto"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🤖 Tự động
            </button>
            <button
              onClick={switchToManual}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "manual"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🖐️ Thủ công
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {/* KHU VỰC UPLOAD (Chưa có file) */}
        {!file && (
          <div className="flex flex-col items-center justify-center mt-20 animate-in fade-in slide-in-from-bottom-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-2xl h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-white flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="font-medium text-lg text-slate-600">
                Click để tải lên CV PDF
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Hỗ trợ file PDF mọi định dạng
              </p>
            </div>
          </div>
        )}

        {/* TOOLBAR (Đã có file) */}
        {file && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center justify-between sticky top-20 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded text-red-600 flex items-center justify-center font-bold text-xs">
                PDF
              </div>
              <div>
                <p className="font-semibold line-clamp-1">{file.name}</p>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Xóa / Chọn lại
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleProcess}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    {activeTab === "auto" ? "Đang chạy AI..." : "Đang xử lý..."}
                  </>
                ) : (
                  <>
                    {activeTab === "auto"
                      ? "🚀 Bắt đầu Che (Auto)"
                      : "🔥 Xóa vùng đã chọn"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* === WORKSPACE: THỦ CÔNG (SCROLL VIEW) === */}
        {activeTab === "manual" && !resultPdfUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in zoom-in-95">
            {/* THANH CÔNG CỤ TRÁI (Sticky) */}
            <div className="lg:col-span-1">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 sticky top-40 space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Màu che
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={handleEyeDropper}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 border border-slate-300"
                    >
                      🖊️ Hút màu
                    </button>
                  </div>
                  <div className="flex items-center gap-2 border rounded p-1 bg-slate-50">
                    <input
                      type="color"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                    />
                    <span className="text-sm text-slate-600 font-mono uppercase">
                      {pickedColor}
                    </span>
                  </div>
                </div>

                {/* <div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={isSnapping} onChange={(e) => setIsSnapping(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm font-medium">Chế độ Hít chữ (Snapping)</span>
                        </label>
                        <p className="text-xs text-slate-500 mt-1 pl-6">Vùng vẽ sẽ tự động ôm sát vào từ gần nhất.</p>
                    </div> */}

                <div className="pt-4 border-t">
                  <button
                    onClick={() => setBoxes([])}
                    className="w-full text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded text-sm font-medium"
                  >
                    🗑️ Xóa hết vùng vẽ
                  </button>
                </div>
              </div>
            </div>

            {/* VÙNG VẼ (PHẢI) - CUỘN DỌC */}
            <div className="lg:col-span-3 bg-slate-200 rounded-xl p-6 min-h-[500px] flex flex-col items-center gap-8 overflow-y-auto max-h-[85vh] border-2 border-dashed border-slate-300 scroll-smooth">
              {loading && Object.keys(previewUrls).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
                  <p>Đang tải {totalPages} trang...</p>
                </div>
              )}

              {/* RENDER TẤT CẢ CÁC TRANG */}
              {Array.from({ length: totalPages }).map((_, pageIndex) =>
                previewUrls[pageIndex] ? (
                  <div
                    key={pageIndex}
                    className="relative shadow-2xl bg-white group/page transition-transform "
                  >
                    <div className="absolute -left-12 top-0 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      Page {pageIndex + 1}
                    </div>

                    <div
                      className="relative cursor-crosshair inline-block"
                      // GIỚI HẠN CHIỀU RỘNG ĐỂ ẢNH NÉT CĂNG
                      style={{ width: "100%", maxWidth: "850px" }}
                      onMouseDown={(e) => handleMouseDown(e, pageIndex)}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <img
                        id={`page-image-${pageIndex}`}
                        src={previewUrls[pageIndex]}
                        alt={`Page ${pageIndex + 1}`}
                        className="w-full pointer-events-none select-none block"
                        draggable={false}
                      />

                      {/* Hộp đã vẽ (Lọc theo trang) */}
                      {boxes
                        .filter((b) => b.pageIndex === pageIndex)
                        .map((box) => (
                          <div
                            key={box.id}
                            style={{
                              position: "absolute",
                              left: box.x,
                              top: box.y,
                              width: box.w,
                              height: box.h,
                              backgroundColor: pickedColor,
                              opacity: 0.7,
                              border: "1px solid rgba(0,0,0,0.2)",
                            }}
                            className="group"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBox(box.id);
                              }}
                              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                      {/* Hộp đang vẽ */}
                      {currentBox && currentBox.pageIndex === pageIndex && (
                        <div
                          style={{
                            position: "absolute",
                            left: currentBox.x,
                            top: currentBox.y,
                            width: currentBox.w,
                            height: currentBox.h,
                            backgroundColor: "rgba(255, 0, 0, 0.2)",
                            border: "2px dashed red",
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key={pageIndex}
                    className="w-[800px] h-[1000px] bg-white animate-pulse rounded flex items-center justify-center text-slate-300"
                  >
                    Loading Page {pageIndex + 1}...
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* 3. KẾT QUẢ (Cho cả Auto & Manual) */}
        {resultPdfUrl && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {/* THANH TRẠNG THÁI */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-600">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-green-800">
                    Xử lý thành công!
                  </h3>
                  <p className="text-sm text-green-600">
                    Đã áp dụng che thông tin.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={resultPdfUrl}
                  download={`redacted_${file?.name}`}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium shadow-md shadow-green-200 flex items-center gap-2"
                >
                  📥 Tải xuống PDF
                </a>

                {/* Nút Fallback Auto -> Manual */}
                {activeTab === "auto" && (
                  <button
                    onClick={switchToManual}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors"
                  >
                    🛠️ Chưa ưng ý? Sửa thủ công
                  </button>
                )}

                {/* Nút sửa lại Manual */}
                {activeTab === "manual" && (
                  <button
                    onClick={() => setResultPdfUrl(null)}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-lg font-medium shadow-sm"
                  >
                    ✏️ Vẽ thêm / Sửa lại
                  </button>
                )}
              </div>
            </div>

            {/* HIỂN THỊ KẾT QUẢ */}
            {activeTab === "auto" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[85vh]">
                <div className="bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                  <div className="bg-slate-50 p-3 border-b text-xs font-bold text-slate-500 uppercase">
                    Bản gốc
                  </div>
                  {originalPdfUrl && (
                    <iframe
                      src={`${originalPdfUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full"
                    />
                  )}
                </div>
                <div className="bg-white rounded-xl shadow border overflow-hidden flex flex-col">
                  <div className="bg-blue-50 p-3 border-b text-xs font-bold text-blue-600 uppercase">
                    Kết quả Tự động quét (trang 1)
                  </div>
                  <iframe
                    src={`${resultPdfUrl}#toolbar=0&navpanes=0`}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="h-[85vh] bg-white rounded-xl shadow border overflow-hidden">
                <iframe
                  src={`${resultPdfUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
