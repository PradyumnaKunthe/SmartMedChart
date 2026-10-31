with open("frontend/src/pages/doctor/Patients.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update loadPatients and state
old_p1 = '''  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all") // 'all', 'active', 'discharged'
  const [sortBy, setSortBy] = useState("name_asc") // 'name_asc', 'name_desc', 'id_asc'
  const [viewMode, setViewMode] = useState("table") // 'table', 'grid'
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadPatients(currentSearch = "", isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorPatients(currentSearch)
      const raw = Array.isArray(data) ? data : []
      setPatients(hideTestPatients(raw))
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient records. Check server connection.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients("")
  }, [])

  // Filtering & Sorting
  const filteredPatients = useMemo(() => {
    let list = patients

    if (filterStatus === "active") {
      list = list.filter((p) => p.is_active)
    } else if (filterStatus === "discharged") {
      list = list.filter((p) => !p.is_active)
    }'''

new_p1 = '''  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("name_asc") // 'name_asc', 'name_desc', 'id_asc'
  const [viewMode, setViewMode] = useState("table") // 'table', 'grid'
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadPatients(currentSearch = "", isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const data = await getDoctorPatients(currentSearch)
      const raw = Array.isArray(data) ? data : []
      const visible = hideTestPatients(raw).filter(
        (p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED"
      )
      setPatients(visible)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Unable to load patient records. Check server connection.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients("")
  }, [])

  // Filtering & Sorting
  const filteredPatients = useMemo(() => {
    let list = patients.filter(
      (p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED"
    )'''

assert old_p1 in code, "old_p1 not found in Patients.jsx"
code = code.replace(old_p1, new_p1, 1)

old_deps = '  }, [patients, filterStatus, search, sortBy])'
new_deps = '  }, [patients, search, sortBy])'
assert old_deps in code, "old_deps not found in Patients.jsx"
code = code.replace(old_deps, new_deps, 1)

# 2. Update KPI Cards
old_p2 = '''  const activeCount = useMemo(() => patients.filter((p) => p.is_active).length, [patients])
  const dischargedCount = Math.max(0, patients.length - activeCount)'''

new_p2 = '''  const activeCount = patients.length
  const assignedBedCount = useMemo(() => patients.filter((p) => Boolean(p.bed_id)).length, [patients])'''

assert old_p2 in code, "old_p2 not found in Patients.jsx"
code = code.replace(old_p2, new_p2, 1)

old_statcards = '''        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Assigned Patients"
            value={patients.length}
            description="All active and past records"
            icon={Users}
            variant="sky"
          />
          <StatCard
            title="Active Inpatients"
            value={activeCount}
            description="Currently in active care"
            icon={UserRound}
            variant="emerald"
            badge="In Hospital"
          />
          <StatCard
            title="Discharged Records"
            value={dischargedCount}
            description="Treatment concluded"
            icon={CheckCircle2}
            variant="neutral"
          />
        </div>'''

new_statcards = '''        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Active Inpatients"
            value={activeCount}
            description="Under active clinical care"
            icon={UserRound}
            variant="emerald"
            badge="In Hospital"
          />
          <StatCard
            title="Ward Bed Admitted"
            value={assignedBedCount}
            description="Patients with assigned beds"
            icon={Building2}
            variant="sky"
          />
        </div>'''

assert old_statcards in code, "old_statcards not found in Patients.jsx"
code = code.replace(old_statcards, new_statcards, 1)

# 3. Remove status filter pills
old_filter_pills = '''          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-semibold mr-1">Status:</span>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("all")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All ({patients.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("active")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Active Inpatients ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus("discharged")
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                filterStatus === "discharged"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Discharged ({dischargedCount})
            </button>
          </div>'''

new_filter_pills = '''          {/* Active Inpatient Status Banner */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs">
              Active Inpatients ({activeCount})
            </span>
          </div>'''

assert old_filter_pills in code, "old_filter_pills not found in Patients.jsx"
code = code.replace(old_filter_pills, new_filter_pills, 1)

# 4. Table and Grid Badges
old_tbl_badge = '''                          <Badge
                            variant={patient.is_active ? "success" : "neutral"}
                            size="sm"
                            dot
                          >
                            {patient.is_active ? "Active Inpatient" : "Discharged"}
                          </Badge>'''

new_tbl_badge = '''                          <Badge
                            variant="success"
                            size="sm"
                            dot
                          >
                            Active Inpatient
                          </Badge>'''

assert old_tbl_badge in code, "old_tbl_badge not found in Patients.jsx"
code = code.replace(old_tbl_badge, new_tbl_badge, 1)

old_grid_badge = '''                      <Badge
                        variant={patient.is_active ? "success" : "neutral"}
                        size="sm"
                        dot
                      >
                        {patient.is_active ? "Active" : "Discharged"}
                      </Badge>'''

new_grid_badge = '''                      <Badge
                        variant="success"
                        size="sm"
                        dot
                      >
                        Active Inpatient
                      </Badge>'''

assert old_grid_badge in code, "old_grid_badge not found in Patients.jsx"
code = code.replace(old_grid_badge, new_grid_badge, 1)

with open("frontend/src/pages/doctor/Patients.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("Patients.jsx patched successfully")

