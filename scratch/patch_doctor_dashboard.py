with open("frontend/src/pages/doctor/DoctorDashboard.jsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update loadPatients and activePatients
old_p1 = '''    try {
      const data = await getDoctorPatients()
      const visiblePatients = hideTestPatients(Array.isArray(data) ? data : [])
      setPatients(visiblePatients)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load assigned patients.",
      )
      setPatients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const activePatients = useMemo(
    () => patients.filter((patient) => patient.is_active).length,
    [patients],
  )

  const inactivePatients = Math.max(0, patients.length - activePatients)
  const recentPatients = useMemo(() => patients.slice(0, 6), [patients])'''

new_p1 = '''    try {
      const data = await getDoctorPatients()
      const rawList = Array.isArray(data) ? data : []
      const visiblePatients = hideTestPatients(rawList).filter(
        (p) => Boolean(p.is_active) && p.lifecycle_status !== "DISCHARGED"
      )
      setPatients(visiblePatients)
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load assigned patients.",
      )
      setPatients([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [])

  const activePatients = patients.length
  const admittedWithBed = useMemo(
    () => patients.filter((patient) => Boolean(patient.bed_id)).length,
    [patients],
  )
  const recentPatients = useMemo(() => patients.slice(0, 6), [patients])'''

assert old_p1 in code, "old_p1 not found in DoctorDashboard.jsx"
code = code.replace(old_p1, new_p1, 1)

# 2. Update KPI StatCards
old_p2 = '''        {/* Clinical KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Assigned"
            value={patients.length}
            description="Patient encounters on record"
            icon={Users}
            variant="sky"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="Active Inpatients"
            value={activePatients}
            description="Currently in ward beds"
            icon={UserRound}
            variant="emerald"
            badge="Active Care"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="Discharged Records"
            value={inactivePatients}
            description="Historical patient cases"
            icon={CheckCircle2}
            variant="neutral"
          />
          <StatCard
            title="AI Safety Protocol"
            value="Active"
            description="Continuous risk & allergy scanning"
            icon={ShieldCheck}
            variant="indigo"
            badge="Protected"
            onClick={() => navigate("/doctor/ai")}
          />
        </div>'''

new_p2 = '''        {/* Clinical KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Inpatients"
            value={activePatients}
            description="Under primary clinical care"
            icon={UserRound}
            variant="emerald"
            badge="Active Care"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="Ward Bed Admitted"
            value={admittedWithBed}
            description="Assigned inpatient beds"
            icon={Users}
            variant="sky"
            onClick={() => navigate("/doctor/patients")}
          />
          <StatCard
            title="AI Safety Protocol"
            value="Active"
            description="Continuous risk & allergy scanning"
            icon={ShieldCheck}
            variant="indigo"
            badge="Protected"
            onClick={() => navigate("/doctor/ai")}
          />
        </div>'''

assert old_p2 in code, "old_p2 not found in DoctorDashboard.jsx"
code = code.replace(old_p2, new_p2, 1)

# 3. Badge in recent inpatients
old_p3 = '''                      <Badge
                        variant={patient.is_active ? "success" : "neutral"}
                        size="sm"
                        dot
                      >
                        {patient.is_active ? "Active" : "Discharged"}
                      </Badge>'''

new_p3 = '''                      <Badge
                        variant="success"
                        size="sm"
                        dot
                      >
                        Active Inpatient
                      </Badge>'''

assert old_p3 in code, "old_p3 not found in DoctorDashboard.jsx"
code = code.replace(old_p3, new_p3, 1)

with open("frontend/src/pages/doctor/DoctorDashboard.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("DoctorDashboard.jsx patched successfully")

