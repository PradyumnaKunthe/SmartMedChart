import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react"

import {
  createBed,
  createWard,
  deactivateBed,
  getWardBeds,
  getWards,
} from "../../services/admin"


function StatCard({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-white">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
          <Icon className="h-5 w-5 text-cyan-400" />
        </div>
      </div>
    </div>
  )
}


function WardCard({
  ward,
  onOpen,
}) {
  const occupancyPercentage =
    ward.total_beds > 0
      ? Math.round(
          (ward.occupied_beds /
            ward.total_beds) *
            100,
        )
      : 0

  return (
    <button
      type="button"
      onClick={() => onOpen(ward)}
      className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-slate-900/90"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
            <Building2 className="h-5 w-5 text-cyan-400" />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              {ward.name}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {ward.code}
            </p>
          </div>
        </div>

        <span className="text-xs text-slate-500 group-hover:text-cyan-400">
          Open →
        </span>
      </div>

      {ward.description && (
        <p className="mt-4 line-clamp-2 text-sm text-slate-400">
          {ward.description}
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-950 p-3">
          <p className="text-xs text-slate-500">
            Total
          </p>

          <p className="mt-1 font-semibold text-white">
            {ward.total_beds}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-3">
          <p className="text-xs text-slate-500">
            Available
          </p>

          <p className="mt-1 font-semibold text-emerald-400">
            {ward.available_beds}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-3">
          <p className="text-xs text-slate-500">
            Occupied
          </p>

          <p className="mt-1 font-semibold text-amber-400">
            {ward.occupied_beds}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all"
          style={{
            width: `${occupancyPercentage}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {occupancyPercentage}% occupied
      </p>
    </button>
  )
}


function BedCard({
  bed,
  onDeactivate,
}) {
  const occupied = bed.is_occupied

  return (
    <div
      className={[
        "group relative rounded-2xl border p-4 transition",
        occupied
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-12 w-12 items-center justify-center rounded-xl",
            occupied
              ? "bg-amber-500/10"
              : "bg-emerald-500/10",
          ].join(" ")}
        >
          <BedDouble
            className={[
              "h-6 w-6",
              occupied
                ? "text-amber-400"
                : "text-emerald-400",
            ].join(" ")}
          />
        </div>

        <span
          className={[
            "rounded-full border px-2.5 py-1 text-xs font-semibold",
            occupied
              ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
          ].join(" ")}
        >
          {occupied
            ? "OCCUPIED"
            : "AVAILABLE"}
        </span>
      </div>

      <p className="mt-4 text-lg font-bold text-white">
        {bed.bed_number}
      </p>

      {occupied && bed.patient ? (
        <div className="mt-3 rounded-xl bg-slate-950 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Patient
          </p>

          <p className="mt-1 font-medium text-white">
            {bed.patient.full_name}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {bed.patient.patient_id}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          This bed is currently available.
        </p>
      )}

      {!occupied && (
        <button
          type="button"
          onClick={() => onDeactivate(bed)}
          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Deactivate bed
        </button>
      )}
    </div>
  )
}


export default function WardBedManagement() {
  const [wards, setWards] = useState([])
  const [selectedWard, setSelectedWard] =
    useState(null)

  const [wardBeds, setWardBeds] =
    useState(null)

  const [loading, setLoading] = useState(true)
  const [bedsLoading, setBedsLoading] =
    useState(false)

  const [error, setError] = useState("")

  const [showAddWard, setShowAddWard] =
    useState(false)

  const [showAddBed, setShowAddBed] =
    useState(false)

  const [wardForm, setWardForm] =
    useState({
      name: "",
      code: "",
      description: "",
    })

  const [bedNumber, setBedNumber] =
    useState("")

  const [savingWard, setSavingWard] =
    useState(false)

  const [savingBed, setSavingBed] =
    useState(false)


  async function loadWards() {
    setLoading(true)
    setError("")

    try {
      const result = await getWards()

      setWards(result.wards || [])

      if (
        selectedWard &&
        !(result.wards || []).some(
          (ward) =>
            ward.id === selectedWard.id,
        )
      ) {
        setSelectedWard(null)
        setWardBeds(null)
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to load wards.",
      )
    } finally {
      setLoading(false)
    }
  }


  async function openWard(ward) {
    setSelectedWard(ward)
    setBedsLoading(true)
    setError("")

    try {
      const result =
        await getWardBeds(ward.id)

      setWardBeds(result)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to load beds.",
      )
    } finally {
      setBedsLoading(false)
    }
  }


  async function handleCreateWard(event) {
    event.preventDefault()

    if (!wardForm.name.trim()) {
      setError("Ward name is required.")
      return
    }

    if (!wardForm.code.trim()) {
      setError("Ward code is required.")
      return
    }

    setSavingWard(true)
    setError("")

    try {
      await createWard(
        wardForm.name.trim(),
        wardForm.code.trim(),
        wardForm.description.trim() ||
          null,
      )

      setWardForm({
        name: "",
        code: "",
        description: "",
      })

      setShowAddWard(false)

      await loadWards()
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to create ward.",
      )
    } finally {
      setSavingWard(false)
    }
  }


  async function handleCreateBed(event) {
    event.preventDefault()

    if (!selectedWard) {
      return
    }

    if (!bedNumber.trim()) {
      setError("Bed number is required.")
      return
    }

    setSavingBed(true)
    setError("")

    try {
      await createBed(
        selectedWard.id,
        bedNumber.trim(),
      )

      setBedNumber("")
      setShowAddBed(false)

      await openWard(selectedWard)
      await loadWards()
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to create bed.",
      )
    } finally {
      setSavingBed(false)
    }
  }


  async function handleDeactivateBed(
    bed,
  ) {
    if (!selectedWard) {
      return
    }

    const confirmed =
      window.confirm(
        `Deactivate bed ${bed.bed_number}?`,
      )

    if (!confirmed) {
      return
    }

    try {
      await deactivateBed(
        selectedWard.id,
        bed.id,
      )

      await openWard(selectedWard)
      await loadWards()
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to deactivate bed.",
      )
    }
  }


  useEffect(() => {
    loadWards()
  }, [])


  const totalBeds = wards.reduce(
    (sum, ward) =>
      sum + Number(ward.total_beds || 0),
    0,
  )

  const availableBeds = wards.reduce(
    (sum, ward) =>
      sum +
      Number(
        ward.available_beds || 0,
      ),
    0,
  )

  const occupiedBeds = wards.reduce(
    (sum, ward) =>
      sum +
      Number(
        ward.occupied_beds || 0,
      ),
    0,
  )


  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        
<div className="mb-5">
  <Link
    to="/admin/dashboard"
    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:bg-slate-800 hover:text-white"
  >
    <ArrowLeft className="h-4 w-4" />
    Back to Admin Dashboard
  </Link>
</div>


        {/* =================================================
            Header
        ================================================= */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10">
                <Building2 className="h-6 w-6 text-cyan-400" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Ward & Bed Management
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Configure hospital wards and manage
                  their beds.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAddWard(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <Plus className="h-4 w-4" />
              Add Ward
            </button>

            <button
              type="button"
              onClick={loadWards}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  loading
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />
              Refresh
            </button>
          </div>
        </div>


        {/* =================================================
            Stats
        ================================================= */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Wards"
            value={wards.length}
            icon={Building2}
          />

          <StatCard
            label="Total Beds"
            value={totalBeds}
            icon={BedDouble}
          />

          <StatCard
            label="Available Beds"
            value={availableBeds}
            icon={CheckCircle2}
          />

          <StatCard
            label="Occupied Beds"
            value={occupiedBeds}
            icon={Users}
          />
        </div>


        {/* =================================================
            Error
        ================================================= */}

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-300/70 hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}


        {/* =================================================
            Ward view
        ================================================= */}

        {!selectedWard ? (
          <>
            <div className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">
                  Hospital Wards
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select a ward to view and manage its beds.
                </p>
              </div>

              {loading ? (
                <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    Loading wards...
                  </div>
                </div>
              ) : wards.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-6 text-center">
                  <Building2 className="h-12 w-12 text-slate-700" />

                  <h3 className="mt-4 text-lg font-semibold text-white">
                    No wards configured
                  </h3>

                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Add your hospital's real wards to begin
                    configuring beds.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAddWard(true)
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add First Ward
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {wards.map((ward) => (
                    <WardCard
                      key={ward.id}
                      ward={ward}
                      onOpen={openWard}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* =================================================
                Selected ward header
            ================================================= */}

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWard(null)
                      setWardBeds(null)
                      setError("")
                    }}
                    className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Ward
                    </p>

                    <h2 className="text-2xl font-bold text-white">
                      {selectedWard.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedWard.code}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddBed(true)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  <Plus className="h-4 w-4" />
                  Add Bed
                </button>
              </div>


              {wardBeds?.counts && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">
                      Total Beds
                    </p>

                    <p className="mt-1 text-xl font-bold text-white">
                      {wardBeds.counts.total}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">
                      Available
                    </p>

                    <p className="mt-1 text-xl font-bold text-emerald-400">
                      {wardBeds.counts.available}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">
                      Occupied
                    </p>

                    <p className="mt-1 text-xl font-bold text-amber-400">
                      {wardBeds.counts.occupied}
                    </p>
                  </div>
                </div>
              )}
            </div>


            {/* =================================================
                Bed layout
            ================================================= */}

            <div className="mt-6">
              {bedsLoading ? (
                <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    Loading beds...
                  </div>
                </div>
              ) : !wardBeds ||
                wardBeds.beds.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-6 text-center">
                  <BedDouble className="h-12 w-12 text-slate-700" />

                  <h3 className="mt-4 text-lg font-semibold text-white">
                    No beds configured
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Add the actual beds present in this ward.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAddBed(true)
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add First Bed
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Bed Layout
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Available beds can later be selected for
                        patient admission.
                      </p>
                    </div>

                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-2 text-emerald-400">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        Available
                      </span>

                      <span className="flex items-center gap-2 text-amber-400">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Occupied
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {wardBeds.beds.map(
                      (bed) => (
                        <BedCard
                          key={bed.id}
                          bed={bed}
                          onDeactivate={
                            handleDeactivateBed
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>


      {/* =====================================================
          ADD WARD MODAL
      ===================================================== */}

      {showAddWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Add Ward
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the real ward details.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddWard(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>


            <form
              onSubmit={handleCreateWard}
              className="space-y-4 p-6"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Ward Name
                </span>

                <input
                  value={wardForm.name}
                  onChange={(event) =>
                    setWardForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. General Ward"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>


              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Ward Code
                </span>

                <input
                  value={wardForm.code}
                  onChange={(event) =>
                    setWardForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="e.g. GW-01"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>


              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Description
                </span>

                <textarea
                  value={wardForm.description}
                  onChange={(event) =>
                    setWardForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional description"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>


              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowAddWard(false)
                  }
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingWard}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {savingWard && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  Create Ward
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* =====================================================
          ADD BED MODAL
      ===================================================== */}

      {showAddBed && selectedWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Add Bed
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Adding bed to {selectedWard.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddBed(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>


            <form
              onSubmit={handleCreateBed}
              className="space-y-4 p-6"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Bed Number
                </span>

                <input
                  value={bedNumber}
                  onChange={(event) =>
                    setBedNumber(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. B-101"
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>


              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowAddBed(false)
                  }
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingBed}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {savingBed && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  Add Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}