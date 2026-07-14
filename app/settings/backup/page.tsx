import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BackupExportManager from "@/components/BackupExportManager";

export default function BackupExportPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <BackupExportManager />
        </main>
      </div>
    </div>
  );
}