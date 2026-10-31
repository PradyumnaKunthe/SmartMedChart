import React, { useEffect, useState, useMemo } from "react"
import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  FileText,
  Filter,
  History,
  Package,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import EmptyState from "../../components/common/EmptyState"
import ErrorState from "../../components/common/ErrorState"

import {
  getPharmacyStats,
  getPharmacyMedicines,
  createPharmacyMedicine,
  updatePharmacyMedicine,
  archivePharmacyMedicine,
  getMedicineBatches,
  addMedicineBatch,
  dispenseMedicine,
  getStockTransactions,
  getUsageReports,
  getLowStockAlerts,
  getExpiryAlerts,
} from "../../services/pharmacy"

const DOSAGE_FORMS = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "INJECTION",
  "OINTMENT",
  "CREAM",
  "DROPS",
  "INHALER",
  "INFUSION",
]

const UNITS = [
  "TABLETS",
  "CAPSULES",
  "VIALS",
  "AMPOULES",
  "BOTTLES",
  "TUBES",
  "BLISTERS",
  "STRIPS",
  "MG",
  "ML",
]

const CATEGORIES = [
  "GENERAL",
  "ANALGESIC",
  "ANTIBIOTIC",
  "ANTIVIRAL",
  "ANTIHYPERTENSIVE",
  "ANTIDIABETIC",
  "ANTIHISTAMINE",
  "CARDIOVASCULAR",
  "RESPIRATORY",
  "GASTROINTESTINAL",
  "NEUROLOGY",
  "PSYCHIATRIC",
  "EMERGENCY",
]

export default function PharmacyManagement() {
  const [activeTab, setActiveTab] = useState("catalogue") // 'catalogue', 'add', 'stock', 'low_stock', 'expiry', 'usage', 'history'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Data states
  const [stats, setStats] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [transactions, setTransactions] = useState([])
  const [usageReports, setUsageReports] = useState(null)
  const [lowStockAlerts, setLowStockAlerts] = useState([])
  const [expiryAlerts, setExpiryAlerts] = useState([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [txTypeFilter, setTxTypeFilter] = useState("ALL")

  // Modals
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false)
  const [editMedModalOpen, setEditMedModalOpen] = useState(false)
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false)
  const [viewBatchesModalOpen, setViewBatchesModalOpen] = useState(false)
  const [selectedMed, setSelectedMed] = useState(null)
  const [medBatches, setMedBatches] = useState([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // Forms
  const [newMedForm, setNewMedForm] = useState({
    name: "",
    generic_name: "",
    brand_name: "",
    strength: "",
    dosage_form: "TABLET",
    unit: "TABLETS",
    category: "GENERAL",
    min_stock_level: 10,
    supplier: "",
    description: "",
  })
  const [newMedSubmitting, setNewMedSubmitting] = useState(false)
  const [newMedError, setNewMedError] = useState("")

  const [editMedForm, setEditMedForm] = useState({
    name: "",
    generic_name: "",
    brand_name: "",
    strength: "",
    dosage_form: "TABLET",
    unit: "TABLETS",
    category: "GENERAL",
    min_stock_level: 10,
    supplier: "",
    description: "",
  })
  const [editMedSubmitting, setEditMedSubmitting] = useState(false)
  const [editMedError, setEditMedError] = useState("")

  const [batchForm, setBatchForm] = useState({
    batch_number: "",
    expiry_date: "",
    quantity: "",
    supplier: "",
    notes: "",
  })
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchError, setBatchError] = useState("")

  const [dispenseForm, setDispenseForm] = useState({
    medicine_id: "",
    batch_id: "",
    quantity: "",
    patient_id: "",
    prescription_id: "",
    notes: "",
  })
  const [dispenseSubmitting, setDispenseSubmitting] = useState(false)
  const [dispenseError, setDispenseError] = useState("")

  // Load all dashboard data
  async function loadData(showFullLoading = true) {
    if (showFullLoading) setLoading(true)
    else setRefreshing(true)
    setError("")

    try {
      const [
        statsData,
        medsData,
        txData,
        reportsData,
        lowStockData,
        expiryData,
      ] = await Promise.all([
        getPharmacyStats(),
        getPharmacyMedicines(),
        getStockTransactions({ limit: 150 }),
        getUsageReports(),
        getLowStockAlerts(),
        getExpiryAlerts(),
      ])

      setStats(statsData)
      setMedicines(Array.isArray(medsData) ? medsData : [])
      setTransactions(Array.isArray(txData) ? txData : [])
      setUsageReports(reportsData)
      setLowStockAlerts(Array.isArray(lowStockData) ? lowStockData : [])
      setExpiryAlerts(Array.isArray(expiryData) ? expiryData : [])
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Unable to load pharmacy management data."
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [])

  function showNotification(msg) {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(""), 4500)
  }

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.generic_name?.toLowerCase().includes(q) ||
        m.brand_name?.toLowerCase().includes(q) ||
        m.strength?.toLowerCase().includes(q)

      const matchesCategory =
        categoryFilter === "ALL" ||
        m.category?.toUpperCase() === categoryFilter.toUpperCase()

      const matchesStatus =
        statusFilter === "ALL" ||
        m.stock_status?.toUpperCase() === statusFilter.toUpperCase()

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [medicines, searchQuery, categoryFilter, statusFilter])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txTypeFilter === "ALL") return true
      return tx.transaction_type?.toUpperCase() === txTypeFilter.toUpperCase()
    })
  }, [transactions, txTypeFilter])

  // Handle Add Medicine submit
  async function handleCreateMedicine(e) {
    e.preventDefault()
    setNewMedError("")

    if (!newMedForm.name.trim() || !newMedForm.strength.trim()) {
      setNewMedError("Medicine name and strength are required.")
      return
    }

    setNewMedSubmitting(true)
    try {
      const payload = {
        name: newMedForm.name.trim().toUpperCase(),
        generic_name: newMedForm.generic_name.trim().toUpperCase() || null,
        brand_name: newMedForm.brand_name.trim().toUpperCase() || null,
        strength: newMedForm.strength.trim().toUpperCase(),
        dosage_form: newMedForm.dosage_form.trim().toUpperCase(),
        unit: newMedForm.unit.trim().toUpperCase(),
        category: newMedForm.category.trim().toUpperCase(),
        min_stock_level: Number(newMedForm.min_stock_level) || 10,
        supplier: newMedForm.supplier.trim().toUpperCase() || null,
        description: newMedForm.description.trim() || null,
      }

      const res = await createPharmacyMedicine(payload)
      showNotification(res.message || "Medicine added to catalogue.")

      // Reset form & switch to catalogue
      setNewMedForm({
        name: "",
        generic_name: "",
        brand_name: "",
        strength: "",
        dosage_form: "TABLET",
        unit: "TABLETS",
        category: "GENERAL",
        min_stock_level: 10,
        supplier: "",
        description: "",
      })
      setActiveTab("catalogue")
      await loadData(false)
    } catch (err) {
      setNewMedError(
        err?.response?.data?.detail || "Failed to create medicine. Please check fields."
      )
    } finally {
      setNewMedSubmitting(false)
    }
  }

  // Handle Edit Medicine modal open
  function openEditModal(med) {
    setSelectedMed(med)
    setEditMedForm({
      name: med.name || "",
      generic_name: med.generic_name || "",
      brand_name: med.brand_name || "",
      strength: med.strength || "",
      dosage_form: med.dosage_form || "TABLET",
      unit: med.unit || "TABLETS",
      category: med.category || "GENERAL",
      min_stock_level: med.min_stock_level ?? 10,
      supplier: med.supplier || "",
      description: med.description || "",
    })
    setEditMedError("")
    setEditMedModalOpen(true)
  }

  // Handle Edit Medicine submit
  async function handleUpdateMedicine(e) {
    e.preventDefault()
    if (!selectedMed) return
    setEditMedError("")

    setEditMedSubmitting(true)
    try {
      const payload = {
        name: editMedForm.name.trim().toUpperCase(),
        generic_name: editMedForm.generic_name.trim().toUpperCase() || null,
        brand_name: editMedForm.brand_name.trim().toUpperCase() || null,
        strength: editMedForm.strength.trim().toUpperCase(),
        dosage_form: editMedForm.dosage_form.trim().toUpperCase(),
        unit: editMedForm.unit.trim().toUpperCase(),
        category: editMedForm.category.trim().toUpperCase(),
        min_stock_level: Number(editMedForm.min_stock_level) || 10,
        supplier: editMedForm.supplier.trim().toUpperCase() || null,
        description: editMedForm.description.trim() || null,
      }

      await updatePharmacyMedicine(selectedMed.id, payload)
      showNotification(`Medicine "${payload.name}" updated successfully.`)
      setEditMedModalOpen(false)
      await loadData(false)
    } catch (err) {
      setEditMedError(
        err?.response?.data?.detail || "Failed to update medicine."
      )
    } finally {
      setEditMedSubmitting(false)
    }
  }

  // Handle Archive Medicine
  async function handleArchive(med) {
    const confirmed = window.confirm(
      `Are you sure you want to archive "${med.name}" (${med.strength})?\n\nThis will remove it from active prescribing. Historical prescriptions will remain preserved.`
    )
    if (!confirmed) return

    try {
      await archivePharmacyMedicine(med.id)
      showNotification(`Medicine "${med.name}" archived from active formulary.`)
      await loadData(false)
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to archive medicine.")
    }
  }

  // Open Add Batch Modal
  function openAddBatchModal(med = null) {
    setSelectedMed(med)
    setBatchForm({
      batch_number: `B-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      expiry_date: "",
      quantity: "",
      supplier: med?.supplier || "",
      notes: "",
    })
    setBatchError("")
    setAddBatchModalOpen(true)
  }

  // Handle Add Batch submit
  async function handleCreateBatch(e) {
    e.preventDefault()
    if (!selectedMed) {
      setBatchError("Please select a medicine.")
      return
    }

    if (!batchForm.batch_number.trim() || !batchForm.expiry_date || !batchForm.quantity) {
      setBatchError("Batch number, expiry date and quantity are required.")
      return
    }

    setBatchSubmitting(true)
    try {
      const payload = {
        batch_number: batchForm.batch_number.trim().toUpperCase(),
        expiry_date: batchForm.expiry_date.trim(),
        quantity: Number(batchForm.quantity),
        supplier: batchForm.supplier.trim().toUpperCase() || null,
        notes: batchForm.notes.trim() || null,
      }

      const res = await addMedicineBatch(selectedMed.id, payload)
      showNotification(res.message || "Stock received successfully.")
      setAddBatchModalOpen(false)
      await loadData(false)
    } catch (err) {
      setBatchError(
        err?.response?.data?.detail || "Failed to receive batch. Please verify inputs."
      )
    } finally {
      setBatchSubmitting(false)
    }
  }

  // View Batches for a Medicine
  async function openViewBatchesModal(med) {
    setSelectedMed(med)
    setViewBatchesModalOpen(true)
    setLoadingBatches(true)
    try {
      const res = await getMedicineBatches(med.id)
      setMedBatches(Array.isArray(res) ? res : [])
    } catch (err) {
      console.error("Failed to load batches", err)
    } finally {
      setLoadingBatches(false)
    }
  }

  // Open Dispense Modal
  function openDispenseModal(med = null) {
    setSelectedMed(med)
    setDispenseForm({
      medicine_id: med ? String(med.id) : "",
      batch_id: "",
      quantity: "1",
      patient_id: "",
      prescription_id: "",
      notes: "",
    })
    setDispenseError("")
    setDispenseModalOpen(true)
  }

  // Handle Dispense submit
  async function handleDispense(e) {
    e.preventDefault()
    const medId = Number(dispenseForm.medicine_id)
    const qty = Number(dispenseForm.quantity)

    if (!medId || qty <= 0) {
      setDispenseError("Please select a medicine and enter a valid quantity.")
      return
    }

    setDispenseSubmitting(true)
    try {
      const payload = {
        medicine_id: medId,
        quantity: qty,
        batch_id: dispenseForm.batch_id ? Number(dispenseForm.batch_id) : null,
        patient_id: dispenseForm.patient_id ? Number(dispenseForm.patient_id) : null,
        prescription_id: dispenseForm.prescription_id ? Number(dispenseForm.prescription_id) : null,
        notes: dispenseForm.notes.trim() || null,
      }

      const res = await dispenseMedicine(payload)
      showNotification(res.message || "Medication dispensed successfully.")
      setDispenseModalOpen(false)
      await loadData(false)
    } catch (err) {
      setDispenseError(
        err?.response?.data?.detail || "Dispense transaction failed."
      )
    } finally {
      setDispenseSubmitting(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-black text-slate-900 tracking-tight uppercase">
                  PHARMACY MANAGEMENT
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Real-time formulary control, multi-batch stock tracking, dispensing ledger & audit compliance
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadData(false)}
            >
              REFRESH
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setActiveTab("add")}
            >
              ADD MEDICINE
            </Button>
          </div>
        </div>

        {/* Global Success Notification */}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top 6 KPI Metric Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                TOTAL MEDICINES
              </span>
              <p className="font-mono text-2xl font-black text-slate-900 mt-1">
                {stats.total_medicines}
              </p>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                Active in Formulary
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-sky-100 bg-sky-50/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-sky-600 block tracking-wider">
                TOTAL STOCK
              </span>
              <p className="font-mono text-2xl font-black text-sky-900 mt-1">
                {stats.total_stock}
              </p>
              <span className="text-[11px] text-sky-700 font-medium mt-0.5 block">
                Units Available
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-amber-600 block tracking-wider">
                LOW-STOCK
              </span>
              <p className="font-mono text-2xl font-black text-amber-900 mt-1">
                {stats.low_stock_medicines}
              </p>
              <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
                Below Minimum Level
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-rose-600 block tracking-wider">
                OUT-OF-STOCK
              </span>
              <p className="font-mono text-2xl font-black text-rose-900 mt-1">
                {stats.out_of_stock_medicines}
              </p>
              <span className="text-[11px] text-rose-700 font-medium mt-0.5 block">
                Zero Inventory
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-emerald-600 block tracking-wider">
                FAST-MOVING
              </span>
              <p className="font-mono text-2xl font-black text-emerald-900 mt-1">
                {stats.fast_moving_medicines}
              </p>
              <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                High Issue Velocity
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-orange-100 bg-orange-50/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-orange-600 block tracking-wider">
                EXPIRING SOON
              </span>
              <p className="font-mono text-2xl font-black text-orange-900 mt-1">
                {stats.medicines_approaching_expiry}
              </p>
              <span className="text-[11px] text-orange-700 font-medium mt-0.5 block">
                Within 30 Days
              </span>
            </div>
          </div>
        )}

        {/* Navigation Tabs (7 Sections) */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
          {[
            { id: "catalogue", label: "MEDICINE CATALOGUE", icon: Package },
            { id: "add", label: "ADD MEDICINE", icon: Plus },
            { id: "stock", label: "STOCK MANAGEMENT", icon: Pill },
            {
              id: "low_stock",
              label: "LOW STOCK ALERTS",
              icon: AlertTriangle,
              count: stats?.low_stock_medicines,
            },
            {
              id: "expiry",
              label: "EXPIRY TRACKING",
              icon: Calendar,
              count: stats?.medicines_approaching_expiry,
            },
            { id: "usage", label: "USAGE REPORTS", icon: TrendingUp },
            { id: "history", label: "RESTOCK & AUDIT HISTORY", icon: History },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-sky-600 text-sky-600 bg-sky-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* SECTION 1: MEDICINE CATALOGUE */}
        {activeTab === "catalogue" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH MEDICINES, GENERICS, BRANDS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">CATEGORY:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 uppercase focus:outline-none"
                  >
                    <option value="ALL">ALL CATEGORIES</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">STOCK:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 uppercase focus:outline-none"
                  >
                    <option value="ALL">ALL STATUSES</option>
                    <option value="IN STOCK">IN STOCK</option>
                    <option value="LOW STOCK">LOW STOCK</option>
                    <option value="OUT OF STOCK">OUT OF STOCK</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Medicines Table */}
            {filteredMedicines.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-heading font-black text-slate-800 text-base uppercase">
                  NO ACTIVE MEDICINES FOUND
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Default and test medicines have been deactivated. Add medicines manually to create an active formulary for doctor prescriptions.
                </p>
                <Button size="sm" icon={Plus} onClick={() => setActiveTab("add")}>
                  ADD FIRST MEDICINE
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">MEDICINE & STRENGTH</th>
                      <th className="py-3 px-4">GENERIC / BRAND</th>
                      <th className="py-3 px-4">DOSAGE FORM</th>
                      <th className="py-3 px-4">CATEGORY</th>
                      <th className="py-3 px-4 text-center">CURRENT STOCK</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-center">BATCHES</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMedicines.map((med) => {
                      const statusVariant =
                        med.stock_status === "OUT OF STOCK"
                          ? "danger"
                          : med.stock_status === "LOW STOCK"
                          ? "warning"
                          : "success"
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 block text-sm">
                              {med.name}
                            </span>
                            <span className="text-[11px] font-mono text-sky-700 font-bold">
                              {med.strength}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-medium block">{med.generic_name || "—"}</span>
                            {med.brand_name && (
                              <span className="text-[10px] text-slate-400 block">
                                Brand: {med.brand_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {med.dosage_form}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {med.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                            {med.total_stock}{" "}
                            <span className="text-[10px] text-slate-400 font-sans font-normal">
                              {med.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={statusVariant} size="sm">
                              {med.stock_status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openViewBatchesModal(med)}
                              className="font-mono text-sky-600 font-bold hover:underline"
                            >
                              {med.batch_count} {med.batch_count === 1 ? "Batch" : "Batches"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddBatchModal(med)}
                              title="Add Stock / Batch"
                            >
                              + STOCK
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openDispenseModal(med)}
                              disabled={med.total_stock <= 0}
                              title="Dispense Medication"
                            >
                              DISPENSE
                            </Button>
                            <button
                              type="button"
                              onClick={() => openEditModal(med)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 transition inline-block align-middle"
                              title="Edit Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchive(med)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition inline-block align-middle"
                              title="Archive Medicine"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: ADD MEDICINE FORM */}
        {activeTab === "add" && (
          <Card>
            <CardHeader
              title="ADD NEW MEDICINE TO FORMULARY"
              subtitle="Enter official pharmaceutical details. Duplicate name and strength entries are strictly prevented."
            />
            <form onSubmit={handleCreateMedicine} className="p-6 space-y-5">
              {newMedError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{newMedError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    MEDICINE NAME <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. PARACETAMOL, AMOXICILLIN"
                    value={newMedForm.name}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        name: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    GENERIC NAME
                  </label>
                  <input
                    type="text"
                    placeholder="E.G. ACETAMINOPHEN"
                    value={newMedForm.generic_name}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        generic_name: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    BRAND NAME (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="E.G. TYLENOL, PANADOL"
                    value={newMedForm.brand_name}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        brand_name: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    STRENGTH <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.G. 500 MG, 10 ML"
                    value={newMedForm.strength}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        strength: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    DOSAGE FORM <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newMedForm.dosage_form}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({ ...prev, dosage_form: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:bg-white focus:outline-none"
                  >
                    {DOSAGE_FORMS.map((df) => (
                      <option key={df} value={df}>
                        {df}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    DISPENSING UNIT
                  </label>
                  <select
                    value={newMedForm.unit}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:bg-white focus:outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    MINIMUM STOCK THRESHOLD
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newMedForm.min_stock_level}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        min_stock_level: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    THERAPEUTIC CATEGORY
                  </label>
                  <select
                    value={newMedForm.category}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 uppercase focus:bg-white focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    PRIMARY SUPPLIER (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="E.G. CIPLA, SUN PHARMA, PFIZER"
                    value={newMedForm.supplier}
                    onChange={(e) =>
                      setNewMedForm((prev) => ({
                        ...prev,
                        supplier: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  CLINICAL NOTES / STORAGE INSTRUCTIONS
                </label>
                <textarea
                  rows={2}
                  placeholder="E.G. STORE BELOW 25C, PROTECT FROM LIGHT, CONTROLLED SUBSTANCE"
                  value={newMedForm.description}
                  onChange={(e) =>
                    setNewMedForm((prev) => ({
                      ...prev,
                      description: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("catalogue")}
                >
                  CANCEL
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={newMedSubmitting}
                >
                  SAVE & ADD TO ACTIVE FORMULARY
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* SECTION 3: STOCK MANAGEMENT */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div>
                <h3 className="font-heading font-black text-slate-900 text-sm uppercase">
                  STOCK & BATCH MANAGEMENT
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Receive inventory batches with batch identifiers, track expiry timelines, and view atomic balances
                </p>
              </div>
              <Button size="sm" icon={Plus} onClick={() => openAddBatchModal()}>
                RECEIVE NEW STOCK BATCH
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicines.map((med) => {
                const stock = med.total_stock ?? 0
                const min = med.min_stock_level ?? 10
                const isLow = stock <= min
                const isOut = stock === 0
                return (
                  <div
                    key={med.id}
                    className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-heading font-black text-slate-900 text-sm uppercase">
                            {med.name}
                          </h4>
                          <span className="text-xs font-mono font-bold text-sky-700">
                            {med.strength} — {med.dosage_form}
                          </span>
                        </div>
                        <Badge
                          variant={isOut ? "danger" : isLow ? "warning" : "success"}
                          size="sm"
                        >
                          {med.stock_status}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            CURRENT STOCK
                          </span>
                          <span className="font-mono text-base font-black text-slate-900">
                            {stock} {med.unit}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            MIN. THRESHOLD
                          </span>
                          <span className="font-mono text-base font-bold text-slate-600">
                            {min} {med.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openViewBatchesModal(med)}
                        className="text-xs text-sky-600 hover:underline font-bold"
                      >
                        {med.batch_count || 0} Batches
                      </button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAddBatchModal(med)}
                        >
                          + BATCH
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={stock <= 0}
                          onClick={() => openDispenseModal(med)}
                        >
                          DISPENSE
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION 4: LOW STOCK ALERTS */}
        {activeTab === "low_stock" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>URGENT RESTOCK PROTOCOL:</strong> Items below designated thresholds generate suggested purchase quantities based on historical burn rate.
                </span>
              </div>
              <Badge variant="warning" size="sm">
                {lowStockAlerts.length} Critical Items
              </Badge>
            </div>

            {lowStockAlerts.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-heading font-black text-slate-900 text-base uppercase">
                  ALL MEDICINES SUFFICIENTLY STOCKED
                </h4>
                <p className="text-xs mt-1">
                  No active medicines are currently below their minimum inventory thresholds.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">MEDICINE & STRENGTH</th>
                      <th className="py-3 px-4 text-center">CURRENT STOCK</th>
                      <th className="py-3 px-4 text-center">MIN. THRESHOLD</th>
                      <th className="py-3 px-4 text-center">DEFICIT</th>
                      <th className="py-3 px-4 text-center">SUGGESTED REORDER</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockAlerts.map((alert) => (
                      <tr key={alert.medicine_id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 block text-sm">
                            {alert.medicine_name}
                          </span>
                          <span className="text-[11px] font-mono text-sky-700 font-bold">
                            {alert.strength} — {alert.dosage_form}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sm text-rose-600">
                          {alert.current_stock} {alert.unit}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                          {alert.min_stock_level}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                          -{alert.deficit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-800 font-mono font-black text-xs border border-sky-100">
                            +{alert.suggested_reorder_quantity} {alert.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={alert.status === "OUT OF STOCK" ? "danger" : "warning"}
                            size="sm"
                          >
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              const med = medicines.find((m) => m.id === alert.medicine_id)
                              openAddBatchModal(med)
                            }}
                          >
                            RESTOCK NOW
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: EXPIRY TRACKING */}
        {activeTab === "expiry" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 text-orange-900 text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-orange-600 shrink-0" />
                <span>
                  <strong>EXPIRATION SAFEGUARD:</strong> Monitoring inventory batches reaching expiry within 90 days. First-Expiry-First-Out (FEFO) dispensing is enforced automatically.
                </span>
              </div>
              <Badge variant="warning" size="sm">
                {expiryAlerts.length} Batches Flagged
              </Badge>
            </div>

            {expiryAlerts.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-heading font-black text-slate-900 text-base uppercase">
                  NO EXPIRING BATCHES
                </h4>
                <p className="text-xs mt-1">
                  All active medicine batches have safe expiration horizons over 90 days.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">MEDICINE NAME</th>
                      <th className="py-3 px-4">BATCH NUMBER</th>
                      <th className="py-3 px-4 text-center">EXPIRY DATE</th>
                      <th className="py-3 px-4 text-center">DAYS REMAINING</th>
                      <th className="py-3 px-4 text-center">QUANTITY REMAINING</th>
                      <th className="py-3 px-4 text-center">ALERT LEVEL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiryAlerts.map((item) => {
                      const levelVariant =
                        item.alert_level === "EXPIRED"
                          ? "danger"
                          : item.alert_level === "CRITICAL"
                          ? "danger"
                          : "warning"
                      return (
                        <tr key={item.batch_id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-extrabold text-slate-900">
                            {item.medicine_name}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-sky-700">
                            {item.batch_number}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold">
                            {item.expiry_date}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black">
                            <span
                              className={
                                item.days_remaining <= 0
                                  ? "text-rose-600"
                                  : item.days_remaining <= 30
                                  ? "text-orange-600"
                                  : "text-amber-600"
                              }
                            >
                              {item.days_remaining <= 0
                                ? "EXPIRED"
                                : `${item.days_remaining} Days`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {item.current_quantity} Units
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={levelVariant} size="sm">
                              {item.alert_level}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 6: MEDICINE USAGE REPORTS */}
        {activeTab === "usage" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div>
                <h3 className="font-heading font-black text-slate-900 text-sm uppercase">
                  MEDICINE USAGE & CONSUMPTION METRICS
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Reports calculated strictly from authorized dispensing transactions — never on prescription draft
                </p>
              </div>
              <Button size="sm" icon={Plus} onClick={() => openDispenseModal()}>
                DISPENSE MEDICATION
              </Button>
            </div>

            {usageReports?.reports?.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-heading font-black text-slate-900 text-base uppercase">
                  NO DISPENSING ACTIVITY LOGGED
                </h4>
                <p className="text-xs mt-1">
                  Once pharmacy staff dispenses orders against prescriptions or charts, usage analytics appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">MEDICINE & STRENGTH</th>
                      <th className="py-3 px-4">CATEGORY</th>
                      <th className="py-3 px-4 text-center">AVAILABLE STOCK</th>
                      <th className="py-3 px-4 text-center">WEEKLY USAGE (7D)</th>
                      <th className="py-3 px-4 text-center">MONTHLY USAGE (30D)</th>
                      <th className="py-3 px-4 text-center">TOTAL DISPENSED</th>
                      <th className="py-3 px-4 text-center">SUGGESTED REORDER</th>
                      <th className="py-3 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usageReports?.reports?.map((rep) => (
                      <tr key={rep.medicine_id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 block text-sm">
                            {rep.medicine_name}
                          </span>
                          <span className="text-[11px] font-mono text-sky-700 font-bold">
                            {rep.strength} — {rep.dosage_form}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {rep.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {rep.available_stock}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sky-700">
                          {rep.weekly_consumption}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {rep.monthly_consumption}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                          {rep.total_dispensed}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {rep.suggested_reorder > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-mono font-bold border border-amber-200">
                              +{rep.suggested_reorder}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={rep.available_stock <= 0}
                            onClick={() => {
                              const med = medicines.find((m) => m.id === rep.medicine_id)
                              openDispenseModal(med)
                            }}
                          >
                            DISPENSE
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 7: RESTOCK & AUDIT HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-black text-slate-900 text-sm uppercase">
                  TRANSACTION AUDIT LEDGER
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Immutable record of every receipt, issue, and adjustment transaction
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">TYPE:</span>
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 uppercase focus:outline-none"
                >
                  <option value="ALL">ALL TYPES</option>
                  <option value="RESTOCK">RESTOCK (+)</option>
                  <option value="DISPENSE">DISPENSE (-)</option>
                </select>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-heading font-black text-slate-900 text-base uppercase">
                  NO TRANSACTIONS LOGGED
                </h4>
                <p className="text-xs mt-1">
                  Add new inventory batches or dispense medicines to generate audit trail entries.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">TIMESTAMP</th>
                      <th className="py-3 px-4">MEDICINE</th>
                      <th className="py-3 px-4 text-center">TYPE</th>
                      <th className="py-3 px-4">BATCH #</th>
                      <th className="py-3 px-4 text-center">QUANTITY</th>
                      <th className="py-3 px-4 text-center">BALANCE AFTER</th>
                      <th className="py-3 px-4">REFERENCE / RECIPIENT</th>
                      <th className="py-3 px-4 text-right">PERFORMED BY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((tx) => {
                      const isRestock = tx.transaction_type === "RESTOCK"
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {tx.created_at ? tx.created_at.replace("T", " ").slice(0, 19) : "—"}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {tx.medicine_name}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={isRestock ? "success" : "neutral"}
                              size="sm"
                            >
                              {tx.transaction_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {tx.batch_number || "—"}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-sm">
                            <span className={isRestock ? "text-emerald-600" : "text-slate-800"}>
                              {isRestock ? `+${tx.quantity}` : tx.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                            {tx.balance_after}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {tx.patient_name ? (
                              <span>Patient: <strong>{tx.patient_name}</strong></span>
                            ) : tx.prescription_id ? (
                              <span>Rx #{tx.prescription_id}</span>
                            ) : (
                              <span>{tx.notes || "—"}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            {tx.performed_by || "System"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL: EDIT MEDICINE */}
        <Modal
          open={editMedModalOpen}
          isOpen={editMedModalOpen}
          onClose={() => setEditMedModalOpen(false)}
          title="EDIT MEDICINE DETAILS"
          subtitle="Update catalog specifications and inventory parameters"
        >
          <form onSubmit={handleUpdateMedicine} className="space-y-4">
            {editMedError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {editMedError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  MEDICINE NAME *
                </label>
                <input
                  type="text"
                  required
                  value={editMedForm.name}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, name: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  STRENGTH *
                </label>
                <input
                  type="text"
                  required
                  value={editMedForm.strength}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, strength: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  GENERIC NAME
                </label>
                <input
                  type="text"
                  value={editMedForm.generic_name}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, generic_name: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  BRAND NAME
                </label>
                <input
                  type="text"
                  value={editMedForm.brand_name}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, brand_name: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  DOSAGE FORM
                </label>
                <select
                  value={editMedForm.dosage_form}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, dosage_form: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold uppercase"
                >
                  {DOSAGE_FORMS.map((df) => (
                    <option key={df} value={df}>
                      {df}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  UNIT
                </label>
                <select
                  value={editMedForm.unit}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, unit: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold uppercase"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  MIN. STOCK
                </label>
                <input
                  type="number"
                  min="0"
                  value={editMedForm.min_stock_level}
                  onChange={(e) =>
                    setEditMedForm((p) => ({ ...p, min_stock_level: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditMedModalOpen(false)}>
                CANCEL
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={editMedSubmitting}>
                SAVE CHANGES
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: ADD BATCH / RECEIVE STOCK */}
        <Modal
          open={addBatchModalOpen}
          isOpen={addBatchModalOpen}
          onClose={() => setAddBatchModalOpen(false)}
          title="RECEIVE INVENTORY BATCH"
          subtitle={
            selectedMed
              ? `Recording new batch receipt for ${selectedMed.name} (${selectedMed.strength})`
              : "Select a medicine and specify batch credentials"
          }
        >
          <form onSubmit={handleCreateBatch} className="space-y-4">
            {batchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {batchError}
              </div>
            )}

            {!selectedMed && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  SELECT MEDICINE *
                </label>
                <select
                  required
                  onChange={(e) => {
                    const m = medicines.find((x) => String(x.id) === e.target.value)
                    setSelectedMed(m)
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold uppercase"
                >
                  <option value="">-- SELECT MEDICINE --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength}) — {m.dosage_form}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  BATCH NUMBER *
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.G. B-2026-001"
                  value={batchForm.batch_number}
                  onChange={(e) =>
                    setBatchForm((p) => ({ ...p, batch_number: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  EXPIRY DATE *
                </label>
                <input
                  type="date"
                  required
                  value={batchForm.expiry_date}
                  onChange={(e) => setBatchForm((p) => ({ ...p, expiry_date: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  QUANTITY RECEIVED *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="E.G. 100, 500"
                  value={batchForm.quantity}
                  onChange={(e) => setBatchForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  SUPPLIER / DISTRIBUTOR
                </label>
                <input
                  type="text"
                  placeholder="E.G. CIPLA PHARMA"
                  value={batchForm.supplier}
                  onChange={(e) =>
                    setBatchForm((p) => ({ ...p, supplier: e.target.value.toUpperCase() }))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                DELIVERY NOTES / INVOICE REF
              </label>
              <textarea
                rows={2}
                placeholder="E.G. INVOICE #INV-4921, INSPECTED & ACCEPTED"
                value={batchForm.notes}
                onChange={(e) => setBatchForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm resize-none uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setAddBatchModalOpen(false)}>
                CANCEL
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={batchSubmitting}>
                CONFIRM STOCK RECEIPT
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: VIEW BATCHES */}
        <Modal
          open={viewBatchesModalOpen}
          isOpen={viewBatchesModalOpen}
          onClose={() => setViewBatchesModalOpen(false)}
          title={`INVENTORY BATCHES — ${selectedMed?.name || ""}`}
          subtitle={`Multi-batch breakdown for ${selectedMed?.name} (${selectedMed?.strength})`}
          size="lg"
        >
          {loadingBatches ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading batch details...</div>
          ) : medBatches.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No inventory batches currently on record for this item.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-400">
                    <th className="py-2.5 px-3">BATCH NUMBER</th>
                    <th className="py-2.5 px-3 text-center">EXPIRY</th>
                    <th className="py-2.5 px-3 text-center">DAYS LEFT</th>
                    <th className="py-2.5 px-3 text-center">AVAILABLE QTY</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {b.batch_number}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{b.expiry_date}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {b.days_until_expiry}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-sky-700">
                        {b.current_quantity} / {b.initial_quantity}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={b.status === "ACTIVE" ? "success" : "neutral"}
                          size="sm"
                        >
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-3 mt-3 border-t border-slate-100">
            <Button size="sm" variant="outline" onClick={() => setViewBatchesModalOpen(false)}>
              CLOSE
            </Button>
          </div>
        </Modal>

        {/* MODAL: DISPENSE MEDICATION */}
        <Modal
          open={dispenseModalOpen}
          isOpen={dispenseModalOpen}
          onClose={() => setDispenseModalOpen(false)}
          title="DISPENSE MEDICATION"
          subtitle="Authorized pharmacy issuance. Stock is atomically decremented from the designated batch."
        >
          <form onSubmit={handleDispense} className="space-y-4">
            {dispenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {dispenseError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                MEDICINE TO DISPENSE *
              </label>
              <select
                required
                value={dispenseForm.medicine_id}
                onChange={(e) => {
                  setDispenseForm((p) => ({ ...p, medicine_id: e.target.value }))
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold uppercase"
              >
                <option value="">-- SELECT FORMULARY ITEM --</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.strength}) — {m.dosage_form} [{m.total_stock} AVAILABLE]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  QUANTITY TO DISPENSE *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="E.G. 10, 30"
                  value={dispenseForm.quantity}
                  onChange={(e) => setDispenseForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  PRESCRIPTION ID (OPTIONAL)
                </label>
                <input
                  type="number"
                  placeholder="E.G. 101"
                  value={dispenseForm.prescription_id}
                  onChange={(e) => setDispenseForm((p) => ({ ...p, prescription_id: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                DISPENSING NOTES
              </label>
              <textarea
                rows={2}
                placeholder="E.G. ISSUED TO WARD 1 NURSE STATION FOR INPATIENT CARE"
                value={dispenseForm.notes}
                onChange={(e) => setDispenseForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm resize-none uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setDispenseModalOpen(false)}>
                CANCEL
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={dispenseSubmitting}>
                CONFIRM DISPENSING
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </MainLayout>
  )
}

