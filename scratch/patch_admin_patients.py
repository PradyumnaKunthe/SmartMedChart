with open("frontend/src/pages/admin/PatientManagement.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. defaultTab = 'active'
old_tab_def = "export default function PatientManagement({ defaultTab = 'all' }) {"
new_tab_def = "export default function PatientManagement({ defaultTab = 'active' }) {"
assert old_tab_def in code, "old_tab_def not found in PatientManagement.jsx"
code = code.replace(old_tab_def, new_tab_def, 1)

# 2. filteredPatients logic
old_source = '''    let source = allPatients
    if (tab === "active") source = activePatients
    else if (tab === "discharged") source = dischargedPatients
    else if (tab === "pending_bill") {
      source = allPatients.filter((p) => (p.billing?.bill_status || "PENDING") === "PENDING")
    }'''

new_source = '''    let source = activePatients
    if (tab === "discharged") {
      source = dischargedPatients
    } else if (tab === "pending_bill") {
      source = activePatients.filter((p) => (p.billing?.bill_status || "PENDING") === "PENDING")
    } else {
      source = activePatients
    }'''

assert old_source in code, "old_source not found in PatientManagement.jsx"
code = code.replace(old_source, new_source, 1)

# 3. Remove "All Records" tab button so tabs are strictly Active Inpatients, Discharged Patients, Pending Bills
old_tab_buttons = '''            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTab("all")
                  setCurrentPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Records ({allPatients.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("active")
                  setCurrentPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "active"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Active Inpatients ({data.counts.active})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("discharged")
                  setCurrentPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "discharged"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Discharged ({data.counts.discharged})
              </button>'''

new_tab_buttons = '''            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTab("active")
                  setCurrentPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "active"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Active Inpatients ({data.counts.active})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("discharged")
                  setCurrentPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "discharged"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Discharged Patients ({data.counts.discharged})
              </button>'''

assert old_tab_buttons in code, "old_tab_buttons not found in PatientManagement.jsx"
code = code.replace(old_tab_buttons, new_tab_buttons, 1)

with open("frontend/src/pages/admin/PatientManagement.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("PatientManagement.jsx patched successfully")

