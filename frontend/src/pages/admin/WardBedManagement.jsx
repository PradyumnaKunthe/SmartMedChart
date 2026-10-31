import { useEffect, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronRight,
  Layers,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Badge from "../../components/common/Badge"
import Button from "../../components/common/Button"
import Card, { CardHeader } from "../../components/common/Card"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import StatCard from "../../components/dashboard/StatCard"

import {
  createBed,
  createWard,
  deactivateBed,
  getWardBeds,
  getWards,
} from "../../services/admin"

export default function WardBedManagement() {
  const [wards, setWards] = useState([])
  const [selectedWard, setSelectedWard] = useState(null)
  const [wardBeds, setWardBeds] = useState(null)

  const [loading, setLoading] = useState(true)
  const [bedsLoading, setBedsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  // Modals
  const [showAddWard, setShowAddWard] = useState(false)
  const [showAddBed, setShowAddBed] = useState(false)

  // Forms
  const [wardForm, setWardForm] = useState({
    name: "",
    code: "",
    description: "",
  })
  const [bedNumber, setBedNumber] = useState("")
  const [savingWard, setSavingWard] = useState(false)
  const [savingBed, setSavingBed] = useState(false)

  async function loadWards(isManual = false) {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    setError("")

    try {
      const result = await getWards()
      const list = result.wards || []
      setWards(list)

      if (selectedWard) {
        const updated = list.find((w) => w.id === selectedWard.id)
        if (updated) setSelectedWard(updated)
        else {
          setSelectedWard(null)
          setWardBeds(null)
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to load hospital wards.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function openWard(ward) {
    setSelectedWard(ward)
    setBedsLoading(true)
    setError("")

    try {
      const result = await getWardBeds(ward.id)
      setWardBeds(result)
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to load ward beds.")
    } finally {
      setBedsLoading(false)
    }
  }

  async function handleCreateWard(e) {
    e.preventDefault()
    if (!wardForm.name.trim() || !wardForm.code.trim()) {
      setError("Ward name and code are required.")
      return
    }

    setSavingWard(true)
    setError("")

    try {
      await createWard(
        wardForm.name.trim(),
        wardForm.code.trim(),
        wardForm.description.trim() || null,
      )
      setWardForm({ name: "", code: "", description: "" })
      setShowAddWard(false)
      await loadWards(true)
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to create ward.")
    } finally {
      setSavingWard(false)
    }
  }

  async function handleCreateBed(e) {
    e.preventDefault()
    if (!selectedWard || !bedNumber.trim()) return

    setSavingBed(true)
    setError("")

    try {
      await createBed(selectedWard.id, bedNumber.trim())
      setBedNumber("")
      setShowAddBed(false)
      await openWard(selectedWard)
      await loadWards(true)
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to add bed.")
    } finally {
      setSavingBed(false)
    }
  }

  async function handleDeactivateBed(bed) {
    if (!selectedWard) return
    if (!window.confirm(`Deactivate bed ${bed.bed_number}? This bed will no longer be available for patient admission.`)) {
      return
    }

    try {
      await deactivateBed(selectedWard.id, bed.id)
      await openWard(selectedWard)
      await loadWards(true)
    } catch (err) {
      alert(err?.response?.data?.detail || "Unable to deactivate bed.")
    }
  }

  useEffect(() => {
    loadWards()
  }, [])

  // Aggregated Stats
  const totalBeds = wards.reduce((sum, w) => sum + Number(w.total_beds || 0), 0)
  const availableBeds = wards.reduce((sum, w) => sum + Number(w.available_beds || 0), 0)
  const occupiedBeds = wards.reduce((sum, w) => sum + Number(w.occupied_beds || 0), 0)
  const overallOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  if (loading) {
    return (
      <MainLayout
        title="Ward & Bed Management"
        subtitle="Real-time inpatient occupancy, bed allocation & ward operations"
      >
        <Loading
          fullScreen
          message="Loading Hospital Wards & Facilities..."
          subtext="Fetching bed occupancy, departments, and active patient admissions"
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout
      title="Ward & Bed Management"
      subtitle="Real-time inpatient occupancy, bed allocation & department capacity planning"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Facility Status: Operational
              </p>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 mt-1">
              Hospital Wards & Bed Capacity
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadWards(true)}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAddWard(true)}
            >
              Add New Ward
            </Button>
          </div>
        </div>

        {error && (
          <ErrorState
            title="Ward Management Error"
            message={error}
            onRetry={() => loadWards(true)}
          />
        )}

        {/* Aggregate KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Wards"
            value={wards.length}
            description="Active clinical departments"
            icon={Building2}
            variant="sky"
          />
          <StatCard
            title="Total Beds"
            value={totalBeds}
            description="Overall licensed bed inventory"
            icon={BedDouble}
            variant="indigo"
          />
          <StatCard
            title="Available Beds"
            value={availableBeds}
            description="Ready for patient admission"
            icon={CheckCircle2}
            variant="emerald"
            badge="Ready"
          />
          <StatCard
            title="Hospital Occupancy"
            value={`${overallOccupancyRate}%`}
            description={`${occupiedBeds} occupied of ${totalBeds} total`}
            icon={Percent}
            variant={overallOccupancyRate > 85 ? "rose" : "amber"}
            progress={overallOccupancyRate}
          />
        </div>

        {/* Selected Ward Inspection Banner / Details */}
        {selectedWard ? (
          <div className="rounded-3xl border border-sky-200/80 bg-white p-5 sm:p-7 shadow-sm space-y-6 animate-fade-in">
            {/* Selected Ward Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWard(null)
                    setWardBeds(null)
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
                  title="Back to all wards"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                      Ward Code: {selectedWard.code}
                    </span>
                    <Badge variant="primary" size="sm">
                      {selectedWard.total_beds} Total Beds
                    </Badge>
                  </div>
                  <h3 className="font-heading text-2xl font-extrabold text-slate-900 mt-0.5">
                    {selectedWard.name}
                  </h3>
                  {selectedWard.description && (
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      {selectedWard.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowAddBed(true)}
                >
                  Add Bed to {selectedWard.code}
                </Button>
              </div>
            </div>

            {/* Beds Grid */}
            {bedsLoading ? (
              <div className="py-12">
                <Loading
                  message="Loading Ward Beds..."
                  subtext={`Fetching bed occupancy details for ${selectedWard.name}`}
                />
              </div>
            ) : !wardBeds?.beds?.length ? (
              <EmptyState
                icon={BedDouble}
                title="No Beds Configured"
                description={`This ward has no active beds registered yet. Click "Add Bed" to provision beds.`}
                actionLabel="Add First Bed"
                actionIcon={Plus}
                onAction={() => setShowAddBed(true)}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Available ({wardBeds.beds.filter((b) => !b.is_occupied).length})
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      Occupied ({wardBeds.beds.filter((b) => b.is_occupied).length})
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {wardBeds.beds.length} Total Units
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {wardBeds.beds.map((bed) => {
                    const occupied = bed.is_occupied
                    return (
                      <div
                        key={bed.id}
                        className={`rounded-2xl border p-4.5 transition-all duration-200 ${
                          occupied
                            ? "border-amber-200 bg-amber-50/40 shadow-xs"
                            : "border-emerald-200/90 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs ${
                              occupied
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            <BedDouble className="h-5 w-5" />
                          </div>

                          <Badge
                            variant={occupied ? "warning" : "success"}
                            size="sm"
                            dot
                          >
                            {occupied ? "Occupied" : "Available"}
                          </Badge>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs text-slate-400 uppercase font-semibold">
                            Bed Identifier
                          </p>
                          <h4 className="font-heading font-extrabold text-slate-900 text-lg">
                            {bed.bed_number}
                          </h4>
                        </div>

                        {occupied && bed.patient ? (
                          <div className="mt-3 pt-3 border-t border-amber-200/60 text-xs">
                            <span className="text-[10px] uppercase font-bold text-amber-800/80 block">
                              Inpatient Admitted:
                            </span>
                            <p className="font-bold text-slate-900 truncate mt-0.5">
                              {bed.patient.full_name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              ID: {bed.patient.patient_id}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-400">
                              Vacant & Ready
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeactivateBed(bed)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Wards Grid */
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Hospital Ward Departments ({wards.length})
              </h3>
              <p className="text-xs text-slate-500">
                Click any ward to inspect beds and admissions
              </p>
            </div>

            {wards.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Wards Configured"
                description="There are currently no hospital wards registered. Click below to add the first department."
                actionLabel="Create New Ward"
                actionIcon={Plus}
                onAction={() => setShowAddWard(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {wards.map((ward) => {
                  const occupancy =
                    ward.total_beds > 0
                      ? Math.round((ward.occupied_beds / ward.total_beds) * 100)
                      : 0

                  return (
                    <div
                      key={ward.id}
                      onClick={() => openWard(ward)}
                      className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                            <Building2 className="h-6 w-6" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                              {ward.code}
                            </span>
                            <h4 className="font-heading font-extrabold text-slate-900 text-base group-hover:text-sky-700 transition-colors">
                              {ward.name}
                            </h4>
                          </div>
                        </div>

                        <span className="text-slate-300 group-hover:text-sky-600 group-hover:translate-x-1 transition-all">
                          <ChevronRight className="h-5 w-5" />
                        </span>
                      </div>

                      {ward.description && (
                        <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {ward.description}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Total
                          </span>
                          <span className="font-heading font-bold text-slate-800 text-sm">
                            {ward.total_beds}
                          </span>
                        </div>
                        <div className="rounded-xl bg-emerald-50/70 p-2 border border-emerald-100/60">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                            Available
                          </span>
                          <span className="font-heading font-bold text-emerald-800 text-sm">
                            {ward.available_beds}
                          </span>
                        </div>
                        <div className="rounded-xl bg-amber-50/70 p-2 border border-amber-100/60">
                          <span className="text-[10px] font-bold uppercase text-amber-700 block">
                            Occupied
                          </span>
                          <span className="font-heading font-bold text-amber-800 text-sm">
                            {ward.occupied_beds}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                          <span>Occupancy</span>
                          <span className={occupancy > 85 ? "text-rose-600 font-bold" : "text-slate-700"}>
                            {occupancy}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              occupancy > 85
                                ? "bg-rose-500"
                                : occupancy > 50
                                ? "bg-amber-500"
                                : "bg-sky-500"
                            }`}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Ward Modal */}
      <Modal
        open={showAddWard}
        onClose={() => setShowAddWard(false)}
        title="Add New Hospital Ward"
        subtitle="Provision a clinical department or inpatient care wing"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateWard} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Ward Name *
            </label>
            <input
              type="text"
              required
              value={wardForm.name}
              onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
              placeholder="e.g. Intensive Care Unit, Pediatric Ward"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Ward Code *
            </label>
            <input
              type="text"
              required
              value={wardForm.code}
              onChange={(e) => setWardForm({ ...wardForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. ICU-A, PED-01, GEN-M"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 uppercase outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={wardForm.description}
              onChange={(e) => setWardForm({ ...wardForm, description: e.target.value })}
              placeholder="Brief notes on equipment, specialized nursing or target patient demographic..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddWard(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingWard}
            >
              Create Ward
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Bed Modal */}
      <Modal
        open={showAddBed}
        onClose={() => setShowAddBed(false)}
        title={`Add Bed to ${selectedWard?.name}`}
        subtitle={`Provision a new patient bed identifier in Ward ${selectedWard?.code}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateBed} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Bed Number / Identifier *
            </label>
            <input
              type="text"
              required
              value={bedNumber}
              onChange={(e) => setBedNumber(e.target.value)}
              placeholder="e.g. Bed-101, B-12"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Must be unique within this ward.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddBed(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingBed}
            >
              Add Bed
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  )
}