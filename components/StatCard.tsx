type StatCardProps = {
  title: string;
  value: string;
  color: string;
};

export default function StatCard({
  title,
  value,
  color,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <h3 className="text-gray-500 text-sm font-medium">
        {title}
      </h3>

      <h2 className={`text-3xl font-bold mt-3 ${color}`}>
        {value}
      </h2>
    </div>
  );
}