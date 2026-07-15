import Navbar from "@/components/Navbar";
import PermissionGuard from "@/components/PermissionGuard";
import RolesPermissionMatrix from "@/components/RolesPermissionMatrix";
import Sidebar from "@/components/Sidebar";

export default function RolesPage() {
  return (
    <div className="flex min-h-screen bg-[#f3f6fb]">
      <Sidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Navbar />

        <main className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          <PermissionGuard permission="roles.view" page>
            <RolesPermissionMatrix />
          </PermissionGuard>
        </main>
      </div>
    </div>
  );
}