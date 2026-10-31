with open("frontend/src/pages/hospital/HospitalDashboard.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update loadPatients and metrics
old_part1 = '''  // Search & Filter & Sort
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL") // ALL, ACTIVE, DISCHARGED
  const [sortBy, setSortBy] = useState("name") // name, id, dob
  const [sortOrder, setSortOrder] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)

  async function loadPatients() {
    setLoading(true)
    setError("")
    try {
      const response = await api.get("/api/hospital/patients")
      const list = Array.isArray(response.data?.patients)
        ? response.data.patients
        : Array.isArray(response.data)
        ? response.data
        : []
      setPatients(hideTestPatients(list))
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to load hospital patient directory."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = patients.length
    const active = patients.filter((p) => Boolean(p.is_active)).length
    const discharged = total - active
    return { total, active, discharged }
  }, [patients])'''

new_part1 = '''  // Search & Filter & Sort
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("name") // name, id, dob
  const [sortOrder, setSortOrder] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)

  async function loadPatients() {
    setLoading(true)
    setError("")
    try {
      const response = await api.get("/api/hospital/patients")
      const list = Array.isArray(response.data?.patients)
        ? response.data.patients
        : Array.isArray(response.data)
        ? response.data
        : []
      const activeList = list.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED")
      setPatients(hideTestPatients(activeList))
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to load hospital patient directory."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  // KPI Metrics
  const metrics = useMemo(() => {
    const active = patients.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED").length
    const withBed = patients.filter((p) => Boolean(p.bed_id)).length
    return { active, withBed }
  }, [patients])'''

assert old_part1 in code, "old_part1 not found in HospitalDashboard.jsx"
code = code.replace(old_part1, new_part1, 1)

# 2. Update filteredPatients
old_part2 = '''    if (statusFilter === "ACTIVE") {
      result = result.filter((p) => Boolean(p.is_active))
    } else if (statusFilter === "DISCHARGED") {
      result = result.filter((p) => !p.is_active)
    }

    result.sort((a, b) => {'''

new_part2 = '''    result = result.filter((p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED")

    result.sort((a, b) => {'''

assert old_part2 in code, "old_part2 not found in HospitalDashboard.jsx"
code = code.replace(old_part2, new_part2, 1)

old_part2_deps = '  }, [patients, search, statusFilter, sortBy, sortOrder])'
new_part2_deps = '  }, [patients, search, sortBy, sortOrder])'
assert old_part2_deps in code, "old_part2_deps not found"
code = code.replace(old_part2_deps, new_part2_deps, 1)

# 3. Update KPI StatCards
old_part3 = '''        {/* KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Registered"
            value={metrics.total}
            subtitle="Lifetime Hospital Records"
            icon={Users}
            color="sky"
          />
          <StatCard
            title="Active Admissions"
            value={metrics.active}
            subtitle="Currently in Hospital Care"
            icon={Activity}
            color="emerald"
          />
          <StatCard
            title="Discharged Records"
            value={metrics.discharged}
            subtitle="Completed Treatments"
            icon={CheckCircle2}
            color="slate"
          />
        </div>'''

new_part3 = '''        {/* KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Active Inpatients"
            value={metrics.active}
            subtitle="Currently in Hospital Care"
            icon={Activity}
            color="emerald"
          />
          <StatCard
            title="Assigned Ward Beds"
            value={metrics.withBed}
            subtitle="Occupied Ward Beds"
            icon={Users}
            color="sky"
          />
        </div>'''

assert old_part3 in code, "old_part3 not found in HospitalDashboard.jsx"
code = code.replace(old_part3, new_part3, 1)

# 4. Remove Discharged tab from lifecycle tabs
old_part4 = '''            {/* Lifecycle Tabs */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "ALL", label: "All Patients" },
                { id: "ACTIVE", label: "Active Inpatients" },
                { id: "DISCHARGED", label: "Discharged" },
              ].map((tab) => {
                const active = statusFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.id)
                      setCurrentPage(1)
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>'''

new_part4 = '''            {/* Active Inpatients Count Pill */}
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 text-white shadow-xs">
                Active Inpatients ({filteredPatients.length})
              </span>
            </div>'''

assert old_part4 in code, "old_part4 not found in HospitalDashboard.jsx"
code = code.replace(old_part4, new_part4, 1)

# 5. Status Badge
old_part5 = '''                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant={patient.is_active ? "success" : "neutral"}
                              size="sm"
                              dot={Boolean(patient.is_active)}
                            >
                              {patient.is_active ? "Active Inpatient" : "Discharged"}
                            </Badge>
                          </td>'''

new_part5 = '''                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant="success"
                              size="sm"
                              dot
                            >
                              Active Inpatient
                            </Badge>
                          </td>'''

assert old_part5 in code, "old_part5 not found in HospitalDashboard.jsx"
code = code.replace(old_part5, new_part5, 1)

with open("frontend/src/pages/hospital/HospitalDashboard.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("HospitalDashboard.jsx patched successfully")

