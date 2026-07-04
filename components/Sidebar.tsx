import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 text-white p-5 min-h-screen">
      <h1 className="text-2xl font-bold mb-8">
        VertexERP
      </h1>

      <ul className="space-y-4">

        

        <li>
          <Link href="/" className="block hover:text-blue-400 transition">
            📊 Dashboard
          </Link>
        </li>

        <li>
          <Link href="/company" className="block hover:text-blue-400 transition">
            🏢 Companies
          </Link>
        </li>

        <li>
          <Link href="/ledger" className="block hover:text-blue-400 transition">
            📒 Ledgers
          </Link>
        </li>

        <li>
          <Link href="/inventory" className="block hover:text-blue-400 transition">
            📦 Inventory
          </Link>
        </li>

        <li>
          <Link href="/sales" className="block hover:text-blue-400 transition">
            🛒 Sales
          </Link>
        </li>

        <li>
          <Link href="/purchase" className="block hover:text-blue-400 transition">
            🧾 Purchase
          </Link>
        </li>

        <li>
           <Link
             href="/expenses"
            className="block hover:text-blue-400 transition"
             >
    💳 Expenses
  </Link>
</li>

          <li>
  <Link
    href="/outstanding"
    className="block hover:text-blue-400 transition"
  >
    💰 Outstanding
  </Link>
</li>
<li>
  <Link
    href="/payments"
    className="block hover:text-blue-400 transition"
  >
    💳 Payments
  </Link>
</li>

        <li>
          <Link href="/reports" className="block hover:text-blue-400 transition">
            📈 Reports
          </Link>
        </li>

      </ul>
    </div>
  );
}