import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import PermissionGuard from "@/components/PermissionGuard";
import TeamManagementManager from "@/components/TeamManagementManager";

export default function TeamManagementPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Navbar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <PermissionGuard permission="team.view" page>
            <TeamManagementManager />
          </PermissionGuard>
        </main>
      </div>
    </div>
  );
}