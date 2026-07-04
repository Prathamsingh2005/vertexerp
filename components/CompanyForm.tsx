"use client";

export default function CompanyForm() {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl shadow-xl p-8">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-5 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            Company Information
          </h2>
          <p className="text-gray-500 mt-1">
            Create a new company for your ERP system.
          </p>
        </div>

        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-semibold text-sm">
          New Company
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Company Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Company Name *
          </label>

          <input
            type="text"
            placeholder="ABC Private Limited"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

        {/* GST */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            GST Number
          </label>

          <input
            type="text"
            placeholder="22AAAAA0000A1Z5"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

        {/* PAN */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            PAN Number
          </label>

          <input
            type="text"
            placeholder="ABCDE1234F"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Email Address
          </label>

          <input
            type="email"
            placeholder="company@example.com"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number
          </label>

          <input
            type="text"
            placeholder="+91 9876543210"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            City
          </label>

          <input
            type="text"
            placeholder="Lucknow"
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300"
          />
        </div>

      </div>

      {/* Address */}
      <div className="mt-6">

        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Address
        </label>

        <textarea
          rows={5}
          placeholder="Enter complete company address..."
          className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all duration-300"
        />

      </div>

      {/* Buttons */}
      <div className="mt-8 flex gap-4">

        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
          Save Company
        </button>

        <button className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-8 py-3 rounded-2xl transition-all duration-300">
          Reset
        </button>

      </div>

    </div>
  );
}