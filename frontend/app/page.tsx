import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-10 flex flex-col items-center bg-white text-gray-800">
      <h1 className="text-4xl font-extrabold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
        AI Tools Platform
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Card cho Tool 1: CV Redactor */}
        <Link href="/tools/cv-redactor" className="group">
          <div className="border border-gray-200 p-6 rounded-xl hover:shadow-xl transition-all cursor-pointer bg-gray-50 hover:bg-white">
            <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-600">🛡️ CV Redactor</h2>
            <p className="text-gray-600">Tự động che thông tin nhạy cảm trong CV bằng AI.</p>
          </div>
        </Link>

        {/* Placeholder cho Tool 2 sau này */}
        <div className="border border-dashed border-gray-300 p-6 rounded-xl flex items-center justify-center text-gray-400">
          Coming Soon: PDF Merger...
        </div>
      </div>
    </main>
  );
}