import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Info,
  Pill,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Zap,
} from "lucide-react"

import MainLayout from "../../components/layout/MainLayout"
import Card, { CardHeader } from "../../components/common/Card"
import Button from "../../components/common/Button"
import Badge from "../../components/common/Badge"
import Loading from "../../components/common/Loading"
import Modal from "../../components/common/Modal"
import {
  createPatientAllergy,
  createPrescription,
  deletePatientAllergy,
  getAvailableNurses,
  getDoctorMedicines,
  getDoctorPatient,
  getDoctorPatients,
  getDoctorWards,
  getDoctorWardBeds,
  getPatientAllergies,
  getPatientAssignedNurse,
  getPrescriptionHistory,
  updatePatientAllergy,
} from "../../services/doctor"

const FREQUENCIES = [
  {
    value: "ONCE_DAILY",
    label: "Once Daily (QD) — 1 dose / day",
    timesCount: 1,
    defaultTimes: ["08:00"],
  },
  {
    value: "TWICE_DAILY",
    label: "Twice Daily (BID) — 2 doses / day",
    timesCount: 2,
    defaultTimes: ["08:00", "20:00"],
  },
  {
    value: "THREE_TIMES_DAILY",
    label: "Three Times Daily (TID) — 3 doses / day",
    timesCount: 3,
    defaultTimes: ["08:00", "14:00", "20:00"],
  },
  {
    value: "FOUR_TIMES_DAILY",
    label: "Four Times Daily (QID) — 4 doses / day",
    timesCount: 4,
    defaultTimes: ["08:00", "12:00", "16:00", "20:00"],
  },
  {
    value: "EVERY_4_HOURS",
    label: "Every 4 Hours (Q4H) — 6 doses / day",
    timesCount: 6,
    defaultTimes: ["04:00", "08:00", "12:00", "16:00", "20:00", "00:00"],
  },
  {
    value: "EVERY_6_HOURS",
    label: "Every 6 Hours (Q6H) — 4 doses / day",
    timesCount: 4,
    defaultTimes: ["06:00", "12:00", "18:00", "00:00"],
  },
  {
    value: "EVERY_8_HOURS",
    label: "Every 8 Hours (Q8H) — 3 doses / day",
    timesCount: 3,
    defaultTimes: ["08:00", "16:00", "00:00"],
  },
  {
    value: "EVERY_12_HOURS",
    label: "Every 12 Hours (Q12H) — 2 doses / day",
    timesCount: 2,
    defaultTimes: ["08:00", "20:00"],
  },
  {
    value: "PRN",
    label: "As Needed (PRN) — Bedside nurse discretion",
    timesCount: 0,
    defaultTimes: [],
  },
  {
    value: "STAT",
    label: "STAT / Immediate Order — 1 immediate dose",
    timesCount: 1,
    defaultTimes: ["08:00"],
  },
  {
    value: "CUSTOM",
    label: "Custom Schedule — Doctor specifies exact times",
    timesCount: -1,
    defaultTimes: ["08:00"],
  },
]

const SEVERITIES = [
  { value: "LOW", label: "Low Severity", variant: "neutral" },
  { value: "MODERATE", label: "Moderate Severity", variant: "warning" },
  { value: "HIGH", label: "High Severity", variant: "danger" },
  { value: "SEVERE", label: "Severe / Anaphylactic", variant: "danger" },
]

function formatApiError(err, fallbackMessage) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => d?.msg || d?.message || (typeof d === "object" ? JSON.stringify(d) : String(d)))
      .join("; ")
  }
  if (detail && typeof detail === "object") {
    return detail?.message || detail?.msg || JSON.stringify(detail)
  }
  return err?.message || fallbackMessage
}

function createDefaultMedicineEntry(index = 1) {
  const today = new Date().toISOString().split("T")[0]
  return {
    id: Date.now() + Math.random(),
    medicine_id: "",
    dose: "",
    route: "Oral",
    frequency: "ONCE_DAILY",
    duration_days: 5,
    start_date: today,
    start_time: "08:00",
    administration_times: ["08:00"],
    is_stat: false,
    instructions: "",
  }
}

export default function CreatePrescription() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const patientId = searchParams.get("patient")
  const replacesId = searchParams.get("replaces")

  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "")
  const [assignedPatients, setAssignedPatients] = useState([])
  const [patient, setPatient] = useState(null)
  const [medicinesCatalogue, setMedicinesCatalogue] = useState([])
  const [allergies, setAllergies] = useState([])

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(null)

  // Multiple medicines list
  const [medicines, setMedicines] = useState([createDefaultMedicineEntry(1)])
  const [prescriptionNotes, setPrescriptionNotes] = useState("")

  // Admission & Bed Allocation state
  const [admitNeeded, setAdmitNeeded] = useState("NO")
  const [wards, setWards] = useState([])
  const [loadingWards, setLoadingWards] = useState(false)
  const [wardError, setWardError] = useState("")
  const [selectedWard, setSelectedWard] = useState("")
  const [selectedBed, setSelectedBed] = useState("")
  const [availableBeds, setAvailableBeds] = useState([])
  const [loadingBeds, setLoadingBeds] = useState(false)
  const [bedApiError, setBedApiError] = useState("")
  const [isAuthError, setIsAuthError] = useState(false)

  // Nurse Assignment state
  const [nurses, setNurses] = useState([])
  const [loadingNurses, setLoadingNurses] = useState(false)
  const [nurseError, setNurseError] = useState("")
  const [selectedNurse, setSelectedNurse] = useState("")
  const [currentAssignedNurse, setCurrentAssignedNurse] = useState(null)
  const [nurseSearchTerm, setNurseSearchTerm] = useState("")

  // Allergy modal state
  const [allergyModalOpen, setAllergyModalOpen] = useState(false)
  const [editingAllergy, setEditingAllergy] = useState(null)
  const [savingAllergy, setSavingAllergy] = useState(false)
  const [deletingAllergyId, setDeletingAllergyId] = useState(null)
  const [allergyError, setAllergyError] = useState("")
  const [allergyForm, setAllergyForm] = useState({
    allergen: "",
    reaction: "",
    severity: "MODERATE",
    notes: "",
  })

  async function loadWardsData() {
    setLoadingWards(true)
    setWardError("")
    try {
      const res = await getDoctorWards()
      const wardList = Array.isArray(res) ? res : res?.wards || []
      setWards(wardList)
      if (wardList.length === 0) {
        setWardError("No active hospital wards found in the database.")
      }
      return wardList
    } catch (err) {
      console.error("Failed to load wards", err)
      setWardError(err?.response?.data?.detail || "Unable to load hospital wards. Please check connection.")
      return []
    } finally {
      setLoadingWards(false)
    }
  }

  async function handleWardChange(wardId, currentPatient = patient) {
    setSelectedWard(wardId)
    setSelectedBed("")
    setAvailableBeds([])
    setBedApiError("")
    setIsAuthError(false)
    if (!wardId) return

    setLoadingBeds(true)
    try {
      const activePid = currentPatient?.id || selectedPatientId || patientId
      const res = await getDoctorWardBeds(wardId, activePid)
      const bedList = Array.isArray(res) ? res : res?.beds || []
      const avail = bedList.filter(
        (b) =>
          b.is_available ||
          !b.is_occupied ||
          String(b.id) === String(currentPatient?.bed_id) ||
          String(b.occupied_by_patient_id) === String(currentPatient?.id)
      )
      setAvailableBeds(avail)
    } catch (err) {
      console.error("Failed to load beds for ward", err)
      const isAuth =
        err?.response?.status === 401 ||
        String(err?.response?.data?.detail || "").toLowerCase().includes("token") ||
        String(err?.response?.data?.detail || "").toLowerCase().includes("expired")
      setIsAuthError(Boolean(isAuth))
      setBedApiError(
        isAuth
          ? "Invalid or expired access token. Please sign in again."
          : err?.response?.data?.detail || "Unable to load beds for the selected ward."
      )
    } finally {
      setLoadingBeds(false)
    }
  }

  async function loadNursesData() {
    setLoadingNurses(true)
    setNurseError("")
    try {
      const res = await getAvailableNurses()
      const nurseList = Array.isArray(res) ? res : res?.nurses || []
      setNurses(nurseList)
      if (nurseList.length === 0) {
        setNurseError("No active registered nurses found in the hospital.")
      }
      return nurseList
    } catch (err) {
      console.error("Failed to load nurses", err)
      setNurseError(
        err?.response?.data?.detail || "Unable to load nurse directory. Please check connection."
      )
      return []
    } finally {
      setLoadingNurses(false)
    }
  }

  async function loadPatientNurseAssignment(targetPid) {
    if (!targetPid) {
      setCurrentAssignedNurse(null)
      setSelectedNurse("")
      return null
    }
    try {
      const res = await getPatientAssignedNurse(targetPid)
      if (res?.assigned_nurse) {
        setCurrentAssignedNurse(res.assigned_nurse)
        setSelectedNurse(String(res.assigned_nurse.nurse_id))
        return res.assigned_nurse
      } else {
        setCurrentAssignedNurse(null)
        setSelectedNurse("")
        return null
      }
    } catch (err) {
      console.error("Failed to load patient nurse assignment", err)
      setCurrentAssignedNurse(null)
      return null
    }
  }

  function handleNurseChange(newNurseId) {
    if (
      currentAssignedNurse &&
      currentAssignedNurse.nurse_id &&
      String(newNurseId) !== String(currentAssignedNurse.nurse_id) &&
      newNurseId !== ""
    ) {
      const selectedObj = nurses.find((n) => String(n.id) === String(newNurseId))
      const newName = selectedObj?.full_name || selectedObj?.username || `Nurse #${newNurseId}`
      const confirmed = window.confirm(
        `Replace current nurse assignment?\n\nThis patient is currently assigned to ${currentAssignedNurse.nurse_name}.\n\nDo you want to reassign this patient to ${newName}?\n\nThe previous assignment will be safely preserved as an inactive historical record.`
      )
      if (!confirmed) {
        return
      }
    }
    setSelectedNurse(newNurseId)
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError("")

      try {
        const activePid = selectedPatientId || patientId
        const medPromise = getDoctorMedicines()
        const wardsPromise = loadWardsData()
        const nursesPromise = loadNursesData()
        const nurseAssignPromise = activePid
          ? loadPatientNurseAssignment(activePid)
          : Promise.resolve(null)

        if (activePid) {
          const [patientData, medicineData, allergyData, historyData] = await Promise.all([
            getDoctorPatient(activePid),
            medPromise,
            getPatientAllergies(activePid),
            replacesId ? getPrescriptionHistory(activePid).catch(() => []) : Promise.resolve([]),
            wardsPromise,
            nursesPromise,
            nurseAssignPromise,
          ])
          setPatient(patientData)
          setMedicinesCatalogue(Array.isArray(medicineData) ? medicineData : [])
          setAllergies(Array.isArray(allergyData) ? allergyData : [])

          if (replacesId && Array.isArray(historyData)) {
            const oldRx = historyData.find(
              (r) => String(r.prescription_id || r.id) === String(replacesId)
            )
            if (oldRx) {
              if (oldRx.notes || oldRx.prescription_notes) {
                setPrescriptionNotes(oldRx.notes || oldRx.prescription_notes)
              }
              const oldItems =
                Array.isArray(oldRx.items) && oldRx.items.length > 0
                  ? oldRx.items
                  : oldRx.medicine_id
                  ? [oldRx]
                  : []
              if (oldItems.length > 0) {
                const today = new Date().toISOString().split("T")[0]
                setMedicines(
                  oldItems.map((it) => ({
                    id: Date.now() + Math.random(),
                    medicine_id: String(it.medicine_id),
                    dose: it.dose || it.dosage || "",
                    route: it.route || "Oral",
                    frequency: it.frequency || "ONCE_DAILY",
                    duration_days: Number(it.duration_days || 5),
                    start_date: today,
                    start_time: it.start_time ? String(it.start_time).slice(0, 5) : "08:00",
                    administration_times: it.administration_times || ["08:00"],
                    is_stat: Boolean(it.is_stat),
                    instructions: it.instructions || "",
                  }))
                )
              }
            }
          }

          if (patientData?.ward_id) {
            setSelectedWard(String(patientData.ward_id))
            if (patientData?.bed_id) {
              setSelectedBed(String(patientData.bed_id))
            }
            handleWardChange(patientData.ward_id, patientData)
          }
        } else {
          const [patientList, medicineData] = await Promise.all([
            getDoctorPatients(),
            medPromise,
            wardsPromise,
            nursesPromise,
          ])
          const list = Array.isArray(patientList) ? patientList : []
          setAssignedPatients(list)
          setMedicinesCatalogue(Array.isArray(medicineData) ? medicineData : [])
          if (list.length === 1) {
            const onlyPid = String(list[0].id)
            setSelectedPatientId(onlyPid)
            const [pData, aData] = await Promise.all([
              getDoctorPatient(onlyPid),
              getPatientAllergies(onlyPid),
              loadPatientNurseAssignment(onlyPid),
            ])
            setPatient(pData)
            setAllergies(Array.isArray(aData) ? aData : [])
            if (pData?.ward_id) {
              setSelectedWard(String(pData.ward_id))
              if (pData?.bed_id) {
                setSelectedBed(String(pData.bed_id))
              }
              handleWardChange(pData.ward_id, pData)
            }
          }
        }
      } catch (requestError) {
        setError(formatApiError(requestError, "Unable to load prescription data."))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [patientId, selectedPatientId])

  async function handleSelectPatientChange(newPid) {
    setSelectedPatientId(newPid)
    if (!newPid) {
      setPatient(null)
      setAllergies([])
      setCurrentAssignedNurse(null)
      setSelectedNurse("")
      return
    }
    setLoading(true)
    setError("")
    try {
      const [patientData, allergyData, nurseData] = await Promise.all([
        getDoctorPatient(newPid),
        getPatientAllergies(newPid),
        getPatientAssignedNurse(newPid).catch(() => null),
      ])
      setPatient(patientData)
      setAllergies(Array.isArray(allergyData) ? allergyData : [])
      if (nurseData?.assigned_nurse) {
        setCurrentAssignedNurse(nurseData.assigned_nurse)
        setSelectedNurse(String(nurseData.assigned_nurse.nurse_id))
      } else {
        setCurrentAssignedNurse(null)
        setSelectedNurse("")
      }
    } catch (err) {
      setError(formatApiError(err, "Unable to load selected patient."))
    } finally {
      setLoading(false)
    }
  }

  // Multi-Medicine Actions
  function handleAddMedicine() {
    setMedicines((prev) => [...prev, createDefaultMedicineEntry(prev.length + 1)])
  }

  function handleRemoveMedicine(id) {
    if (medicines.length <= 1) return
    setMedicines((prev) => prev.filter((m) => m.id !== id))
  }

  function handleMedicineFieldChange(id, field, value) {
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return { ...item, [field]: value }
      })
    )
  }

  function handleFrequencyChange(id, newFrequency) {
    const config = FREQUENCIES.find((f) => f.value === newFrequency)
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const defTimes = config?.defaultTimes ? [...config.defaultTimes] : ["08:00"]
        return {
          ...item,
          frequency: newFrequency,
          administration_times: defTimes,
          start_time: defTimes[0] || "08:00",
        }
      })
    )
  }

  function handleAdminTimeChange(id, timeIndex, newTime) {
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = [...(item.administration_times || [])]
        updated[timeIndex] = newTime
        const newStartTime = timeIndex === 0 ? newTime : item.start_time
        return {
          ...item,
          administration_times: updated,
          start_time: newStartTime,
        }
      })
    )
  }

  function handleAddCustomTime(id) {
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const current = item.administration_times || []
        return {
          ...item,
          administration_times: [...current, "12:00"],
        }
      })
    )
  }

  function handleRemoveCustomTime(id, timeIndex) {
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const current = [...(item.administration_times || [])]
        if (current.length <= 1) return item
        current.splice(timeIndex, 1)
        return {
          ...item,
          administration_times: current,
          start_time: current[0] || item.start_time,
        }
      })
    )
  }

  function calculateDoseCount(med) {
    if (med.frequency === "PRN") return 0
    if (med.frequency === "STAT") return 1
    const timesPerDay = med.administration_times?.length || 1
    return Math.max(1, Number(med.duration_days || 1)) * timesPerDay
  }

  // Allergy management
  function openAddAllergy() {
    setEditingAllergy(null)
    setAllergyForm({ allergen: "", reaction: "", severity: "MODERATE", notes: "" })
    setAllergyError("")
    setAllergyModalOpen(true)
  }

  function openEditAllergy(allergy) {
    setEditingAllergy(allergy)
    setAllergyForm({
      allergen: allergy.allergen || "",
      reaction: allergy.reaction || "",
      severity: allergy.severity || "MODERATE",
      notes: allergy.notes || "",
    })
    setAllergyError("")
    setAllergyModalOpen(true)
  }

  function closeAllergyModal() {
    if (savingAllergy) return
    setAllergyModalOpen(false)
    setEditingAllergy(null)
    setAllergyError("")
  }

  async function handleSaveAllergy(event) {
    event.preventDefault()
    setAllergyError("")

    if (!allergyForm.allergen.trim()) {
      setAllergyError("Please enter the allergen name.")
      return
    }

    const activePid = patient?.id || selectedPatientId || patientId
    setSavingAllergy(true)
    try {
      const payload = {
        allergen: allergyForm.allergen.trim().toUpperCase(),
        reaction: allergyForm.reaction.trim().toUpperCase() || null,
        severity: allergyForm.severity || null,
        notes: allergyForm.notes.trim() || null,
      }

      if (editingAllergy) {
        const result = await updatePatientAllergy(activePid, editingAllergy.id, payload)
        setAllergies((prev) =>
          prev.map((item) => (item.id === editingAllergy.id ? result : item))
        )
      } else {
        const result = await createPatientAllergy(activePid, payload)
        setAllergies((prev) => [...prev, result])
      }
      closeAllergyModal()
    } catch (requestError) {
      setAllergyError(requestError?.response?.data?.detail || "Unable to save allergy record.")
    } finally {
      setSavingAllergy(false)
    }
  }

  async function handleDeleteAllergy(allergy) {
    const activePid = patient?.id || selectedPatientId || patientId
    const confirmed = window.confirm(`Remove allergy "${allergy.allergen}" from patient record?`)
    if (!confirmed) return

    setDeletingAllergyId(allergy.id)
    try {
      await deletePatientAllergy(activePid, allergy.id)
      setAllergies((prev) => prev.filter((item) => item.id !== allergy.id))
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Unable to remove allergy.")
    } finally {
      setDeletingAllergyId(null)
    }
  }

  // Cross-reference medicine with documented allergies
  function checkAllergyForMed(medId) {
    const medObj = medicinesCatalogue.find((m) => String(m.id) === String(medId))
    if (!medObj) return null
    return allergies.find(
      (a) =>
        a.allergen &&
        (medObj.name.toLowerCase().includes(a.allergen.toLowerCase()) ||
          a.allergen.toLowerCase().includes(medObj.name.toLowerCase()))
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setSuccess(null)

    const targetPatientId = patient?.id || selectedPatientId || patientId
    if (!targetPatientId) {
      setError("Please select an active inpatient before authorizing prescription.")
      setSubmitting(false)
      return
    }

    if (medicines.length === 0) {
      setError("Please add at least one medicine to the prescription order.")
      setSubmitting(false)
      return
    }

    // Validate each medicine
    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i]
      const num = i + 1
      if (!m.medicine_id) {
        setError(`Please select a formulary medicine for Medicine #${num}.`)
        setSubmitting(false)
        return
      }
      if (!m.dose || !m.dose.trim()) {
        setError(`Dosage is required for Medicine #${num} (e.g. 500 mg, 1 tablet).`)
        setSubmitting(false)
        return
      }
      if (!m.route || !m.route.trim()) {
        setError(`Administration route is required for Medicine #${num}.`)
        setSubmitting(false)
        return
      }
      if (m.frequency !== "PRN" && (!m.administration_times || m.administration_times.length === 0)) {
        setError(`Please specify at least one administration time for Medicine #${num}.`)
        setSubmitting(false)
        return
      }
    }

    // Validate Inpatient Admission & Bed Allocation
    if (admitNeeded === "YES") {
      if (!selectedWard) {
        setError("Please select a hospital ward for inpatient admission.")
        setSubmitting(false)
        return
      }
      if (!selectedBed) {
        setError("Please select an unoccupied bed for inpatient admission.")
        setSubmitting(false)
        return
      }
      if (!selectedNurse) {
        setError("Please select an assigned nurse for inpatient admission.")
        setSubmitting(false)
        return
      }
    }

    try {
      const formattedItems = medicines.map((m) => ({
        medicine_id: Number(m.medicine_id),
        dose: m.dose.trim(),
        route: m.route.trim(),
        frequency: m.frequency,
        duration_days: Number(m.duration_days || 1),
        start_date: m.start_date,
        start_time: m.start_time || "08:00",
        administration_times: m.administration_times || [],
        is_stat: Boolean(m.is_stat),
        instructions: m.instructions ? m.instructions.trim() : null,
      }))

      const payload = {
        patient_id: Number(targetPatientId),
        replaces_prescription_id: replacesId ? Number(replacesId) : null,
        notes: prescriptionNotes.trim() || null,
        admit_patient: admitNeeded === "YES",
        ward_id: admitNeeded === "YES" && selectedWard ? Number(selectedWard) : null,
        bed_id: admitNeeded === "YES" && selectedBed ? Number(selectedBed) : null,
        nurse_id: admitNeeded === "YES" && selectedNurse ? Number(selectedNurse) : null,
        medicines: formattedItems,
        // Legacy backward compatibility fields
        medicine_id: formattedItems[0].medicine_id,
        dose: formattedItems[0].dose,
        route: formattedItems[0].route,
        frequency: formattedItems[0].frequency,
        duration_days: formattedItems[0].duration_days,
        start_date: formattedItems[0].start_date,
        start_time: formattedItems[0].start_time,
        administration_times: formattedItems[0].administration_times,
        is_stat: formattedItems[0].is_stat,
        instructions: formattedItems[0].instructions,
      }

      const result = await createPrescription(payload)
      setSuccess(result)

      // Synchronize local nurse assignment if returned
      if (result?.nurse_assignment) {
        setCurrentAssignedNurse(result.nurse_assignment)
      }

      // Synchronize local patient state & refresh bed availability if bed was assigned
      if (result?.bed_assignment) {
        setPatient((prev) =>
          prev
            ? {
                ...prev,
                ward_id: result.bed_assignment.ward_id,
                bed_id: result.bed_assignment.bed_id,
                is_admitted: true,
              }
            : prev
        )
        // Refresh beds for this ward to reflect updated occupancy
        if (selectedWard) {
          handleWardChange(selectedWard)
        }
      }
    } catch (requestError) {
      setError(formatApiError(requestError, "Unable to create prescription."))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MainLayout title="Create Prescription">
        <Loading message="Loading patient chart and formulary catalogue..." />
      </MainLayout>
    )
  }

  const totalDosesAcrossAll = medicines.reduce((acc, m) => acc + calculateDoseCount(m), 0)

  const filteredNurses = nurses.filter((n) => {
    if (String(n.id) === String(selectedNurse)) return true
    if (!nurseSearchTerm.trim()) return true
    const term = nurseSearchTerm.toLowerCase()
    return (
      n.full_name?.toLowerCase().includes(term) ||
      n.username?.toLowerCase().includes(term) ||
      String(n.id).includes(term)
    )
  })

  return (
    <MainLayout
      title="Create Prescription"
      subtitle="Issue multi-item medical orders with independent dosing schedules and 5-min nurse alerts"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => {
              const backPid = selectedPatientId || patientId || patient?.id
              navigate(backPid ? `/doctor/patients/${backPid}` : "/doctor/patients")
            }}
          >
            Back to Patient Profile
          </Button>

          {patient && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200/80 rounded-xl px-3.5 py-1.5 shadow-xs">
              <User className="w-3.5 h-3.5 text-sky-600" />
              <span>Patient:</span>
              <span className="font-semibold text-slate-800">
                {patient.first_name} {patient.last_name}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-sky-700">#{patient.patient_id}</span>
            </div>
          )}
        </div>

        {/* Prescription Replacement Notice Banner */}
        {replacesId && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 shrink-0 text-amber-600" />
              <div>
                <span className="font-bold">Prescription Replacement Mode:</span> This new regimen will replace and supersede <span className="font-mono font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-900">Order #{replacesId}</span>. Remaining future unadministered doses will be cancelled, while completed administrations are preserved.
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                const backPid = selectedPatientId || patientId || patient?.id
                navigate(`/doctor/prescriptions/create?patient=${backPid}`)
              }}
            >
              Exit Replacement
            </Button>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Success State Confirmation Card */}
        {success && (
          <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {replacesId
                  ? "Prescription Replaced Successfully"
                  : "Prescription Successfully Created"}
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-lg mx-auto leading-relaxed">
                {success.bed_assignment && success.nurse_assignment ? (
                  <>
                    Prescription Order #{success.prescription_id} containing{" "}
                    <strong className="text-emerald-700 font-bold">
                      {success.medicine_count || medicines.length} medicine(s)
                    </strong>{" "}
                    was saved. Patient {patient?.first_name} {patient?.last_name} (#{patient?.patient_id || selectedPatientId}) admitted to {success.bed_assignment.ward_name}, Bed #{success.bed_assignment.bed_number}, and assigned to {success.nurse_assignment.nurse_name}.
                  </>
                ) : (
                  <>
                    Prescription Order #{success.prescription_id} containing{" "}
                    <strong className="text-emerald-700 font-bold">
                      {success.medicine_count || medicines.length} medicine(s)
                    </strong>{" "}
                    was saved
                    {replacesId ? ` (superseding previous Order #${replacesId})` : ""}, and{" "}
                    <strong className="text-emerald-700 font-bold">
                      {success.schedule_count} individual medication dosing schedule(s)
                    </strong>{" "}
                    with 5-minute pre-dose nurse notifications have been scheduled in the queue.
                  </>
                )}
              </p>
            </div>

            {success.medicines && success.medicines.length > 0 && (
              <div className="max-w-xl mx-auto p-4 bg-white/80 border border-emerald-200/70 rounded-2xl text-left space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Prescribed Regimen Summary:
                </div>
                {success.medicines.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-none"
                  >
                    <div className="flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-bold text-slate-900">{item.medicine_name}</span>
                      <span className="text-slate-500">({item.dose} · {item.route})</span>
                    </div>
                    <Badge variant="primary" size="sm">
                      {item.frequency} · {item.schedule_count} doses
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {success.bed_assignment && (
              <div className="max-w-xl mx-auto p-4 bg-white/80 border border-indigo-200/80 rounded-2xl text-left flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-950 uppercase">
                      Inpatient Admission & Bed Allocation Confirmed
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                      Ward: <strong className="text-slate-900 uppercase">{success.bed_assignment.ward_name}</strong> · Bed Number: <strong className="text-indigo-700 font-bold">#{success.bed_assignment.bed_number}</strong>
                    </div>
                  </div>
                </div>
                <Badge variant="success" size="sm">BED ALLOCATED</Badge>
              </div>
            )}

            {success.nurse_assignment && (
              <div className="max-w-xl mx-auto p-4 bg-white/80 border border-sky-200/80 rounded-2xl text-left flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-sky-950 uppercase">
                      Assigned Primary Nurse Confirmed
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                      Assigned Nurse: <strong className="text-slate-900">{success.nurse_assignment.nurse_name}</strong>{" "}
                      {success.nurse_assignment.nurse_username && (
                        <span className="text-slate-500 font-mono">(@{success.nurse_assignment.nurse_username})</span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="primary" size="sm">NURSE ASSIGNED</Badge>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  const targetPid = selectedPatientId || patientId || patient?.id
                  navigate(targetPid ? `/doctor/patients/${targetPid}` : "/doctor/patients")
                }}
              >
                Return to Patient Chart
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(null)
                  setMedicines([createDefaultMedicineEntry(1)])
                  setPrescriptionNotes("")
                  setAdmitNeeded("NO")
                  setSelectedWard("")
                  setSelectedBed("")
                  setAvailableBeds([])
                  setSelectedNurse("")
                  setCurrentAssignedNurse(null)
                  setNurseSearchTerm("")
                }}
              >
                Write Another Order
              </Button>
            </div>
          </div>
        )}

        {/* Patient Selection Card when navigating without patient ID */}
        {!success && !patient && (
          <Card>
            <CardHeader
              title="Select Inpatient for Prescription"
              subtitle="Choose an active inpatient currently assigned to your clinical care"
            />
            <div className="p-6 space-y-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Inpatient <span className="text-rose-500">*</span>
              </label>
              {assignedPatients.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  No active inpatients are currently assigned to your roster. Please visit the Patients Directory.
                </div>
              ) : (
                <select
                  value={selectedPatientId}
                  onChange={(e) => handleSelectPatientChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="">-- CHOOSE ASSIGNED PATIENT --</option>
                  {assignedPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()} (#{p.patient_id}) {p.bed_id ? `— Bed ${p.bed_id}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Card>
        )}

        {/* Patient Allergies Banner */}
        {!success && patient && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Patient Allergy Safety Review
                  </h3>
                  <p className="text-xs text-slate-500">
                    Documented drug hypersensitivities evaluated automatically against all prescribed items
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={openAddAllergy}
              >
                Add Allergy
              </Button>
            </div>

            {allergies.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>No known drug allergies (NKDA) recorded for this patient.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="p-3 rounded-xl border border-rose-100 bg-rose-50/50 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {allergy.allergen}
                        </span>
                        <Badge
                          variant={
                            allergy.severity === "SEVERE" || allergy.severity === "HIGH"
                              ? "danger"
                              : "warning"
                          }
                          size="sm"
                        >
                          {allergy.severity || "MODERATE"}
                        </Badge>
                      </div>
                      {allergy.reaction && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          Reaction: {allergy.reaction}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditAllergy(allergy)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Edit allergy"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingAllergyId === allergy.id}
                        onClick={() => handleDeleteAllergy(allergy)}
                        className="p-1 text-rose-400 hover:text-rose-600 rounded"
                        title="Delete allergy"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Multi-Medicine Prescription Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6">
              {medicines.map((med, index) => {
                const selectedMedObj = medicinesCatalogue.find(
                  (m) => String(m.id) === String(med.medicine_id)
                )
                const allergyConflict = checkAllergyForMed(med.medicine_id)
                const estimatedDoses = calculateDoseCount(med)
                const freqConfig = FREQUENCIES.find((f) => f.value === med.frequency)

                return (
                  <Card key={med.id}>
                    <CardHeader
                      title={`MEDICINE #${index + 1}${
                        selectedMedObj ? ` — ${selectedMedObj.name.toUpperCase()}` : ""
                      }`}
                      subtitle="Independent dosage, route, frequency, and exact administration times"
                      action={
                        medicines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleRemoveMedicine(med.id)}
                          >
                            Remove Medicine
                          </Button>
                        ) : null
                      }
                    />

                    <div className="p-6 space-y-5">
                      {/* 1. Formulary Medicine Selector */}
                      <div>
                        <label
                          htmlFor={`med_select_${med.id}`}
                          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                        >
                          1. FORMULARY MEDICINE <span className="text-rose-500">*</span>
                        </label>

                        {medicinesCatalogue.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-bold">NO FORMULARY MEDICINES AVAILABLE:</strong>{" "}
                              Please ensure medicines exist in <strong>Pharmacy Management</strong> before prescribing.
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <Pill className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                              id={`med_select_${med.id}`}
                              value={med.medicine_id}
                              onChange={(e) =>
                                handleMedicineFieldChange(med.id, "medicine_id", e.target.value)
                              }
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                            >
                              <option value="">-- SELECT MEDICINE FROM PHARMACY CATALOGUE --</option>
                              {medicinesCatalogue.map((m) => {
                                const stockCount = m.total_stock ?? 0
                                const status =
                                  m.stock_status ||
                                  (stockCount === 0
                                    ? "OUT OF STOCK"
                                    : stockCount <= (m.min_stock_level || 10)
                                    ? "LOW STOCK"
                                    : "IN STOCK")
                                return (
                                  <option key={m.id} value={m.id}>
                                    {m.name} {m.strength ? `(${m.strength})` : ""} — {m.dosage_form || "TABLET"} [{status}: {stockCount} {m.unit || "UNITS"}]
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                        )}

                        {/* Selected Medicine Details Strip */}
                        {selectedMedObj && (
                          <div className="mt-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Pill className="w-4 h-4 text-sky-600 shrink-0" />
                                <span className="font-extrabold text-xs text-slate-900">
                                  {selectedMedObj.name} {selectedMedObj.strength && `(${selectedMedObj.strength})`}
                                </span>
                                <span className="text-xs text-slate-500">
                                  • {selectedMedObj.dosage_form || "TABLET"}
                                </span>
                              </div>
                              <Badge
                                variant={
                                  (selectedMedObj.total_stock ?? 0) === 0
                                    ? "danger"
                                    : (selectedMedObj.total_stock ?? 0) <= (selectedMedObj.min_stock_level || 10)
                                    ? "warning"
                                    : "success"
                                }
                                size="sm"
                              >
                                {(selectedMedObj.total_stock ?? 0) === 0
                                  ? "OUT OF STOCK"
                                  : (selectedMedObj.total_stock ?? 0) <= (selectedMedObj.min_stock_level || 10)
                                  ? "LOW STOCK"
                                  : "IN STOCK"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                              <span>
                                Available Stock:{" "}
                                <strong className="font-extrabold text-slate-900">
                                  {selectedMedObj.total_stock ?? 0} {selectedMedObj.unit || "TABLETS"}
                                </strong>
                              </span>
                              {selectedMedObj.generic_name && (
                                <span className="text-slate-500 font-mono text-[11px]">
                                  Generic: {selectedMedObj.generic_name}
                                </span>
                              )}
                            </div>

                            {/* Stock Warning */}
                            {estimatedDoses > (selectedMedObj.total_stock ?? 0) && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="font-bold">LOW STOCK WARNING:</strong> Prescribed regimen requires approx {estimatedDoses} doses, but current inventory shows {selectedMedObj.total_stock ?? 0} {selectedMedObj.unit || "units"}. Doctor may authorize; pharmacy will fulfill prior to administration.
                                </div>
                              </div>
                            )}

                            {/* Allergy Conflict Warning */}
                            {allergyConflict && (
                              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-pulse">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="font-bold">ALLERGY WARNING:</strong> Patient has a documented allergy to <span className="font-black underline">{allergyConflict.allergen}</span> ({allergyConflict.severity || "Moderate"}), which matches this medicine!
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Dose & Route */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            2. Dose <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 1 Tablet, 500 mg, 10 ml, 1 Vial"
                            value={med.dose}
                            onChange={(e) =>
                              handleMedicineFieldChange(med.id, "dose", e.target.value)
                            }
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            3. Route <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={med.route}
                            onChange={(e) =>
                              handleMedicineFieldChange(med.id, "route", e.target.value)
                            }
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                          >
                            <option value="Oral">Oral (PO)</option>
                            <option value="Intravenous (IV)">Intravenous (IV)</option>
                            <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                            <option value="Subcutaneous (SC)">Subcutaneous (SC)</option>
                            <option value="Inhalation">Inhalation</option>
                            <option value="Topical">Topical</option>
                            <option value="Sublingual">Sublingual</option>
                            <option value="Ophthalmic">Ophthalmic</option>
                            <option value="Rectal">Rectal</option>
                          </select>
                        </div>
                      </div>

                      {/* 3. Frequency & Duration */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            4. Administration Frequency <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={med.frequency}
                            onChange={(e) => handleFrequencyChange(med.id, e.target.value)}
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                          >
                            {FREQUENCIES.map((freq) => (
                              <option key={freq.value} value={freq.value}>
                                {freq.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            5. Duration (Days) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={med.duration_days}
                            onChange={(e) =>
                              handleMedicineFieldChange(med.id, "duration_days", e.target.value)
                            }
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      {/* 4. Flexible Administration Times */}
                      <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-sky-600" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              6. Scheduled Administration Times
                            </span>
                          </div>
                          {med.frequency === "CUSTOM" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              icon={Plus}
                              onClick={() => handleAddCustomTime(med.id)}
                            >
                              Add Time
                            </Button>
                          )}
                        </div>

                        {med.frequency === "PRN" ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                            <strong>AS NEEDED (PRN):</strong> Routine administration schedules are not created in advance. Clinical instructions will be prominently displayed on the bedside nurse administration queue.
                          </div>
                        ) : med.frequency === "STAT" ? (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                            <strong>STAT / IMMEDIATE ORDER:</strong> Generates exactly one immediate medication task due right away for bedside rounds.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {(med.administration_times || []).map((tVal, tIdx) => (
                              <div key={tIdx} className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                  Dose #{tIdx + 1} Time
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="time"
                                    value={tVal}
                                    onChange={(e) =>
                                      handleAdminTimeChange(med.id, tIdx, e.target.value)
                                    }
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                  />
                                  {med.frequency === "CUSTOM" && med.administration_times.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCustomTime(med.id, tIdx)}
                                      className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                      title="Remove time"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                          <span>
                            Dosing Times / Day: <strong>{med.frequency === "PRN" ? "0 (PRN)" : med.administration_times?.length || 1}</strong>
                          </span>
                          <span>
                            Total Estimated Doses: <strong className="text-sky-700">{estimatedDoses}</strong>
                          </span>
                        </div>
                      </div>

                      {/* 5. Start Date & Urgent / STAT */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            7. First Administration Date <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="date"
                              value={med.start_date}
                              onChange={(e) =>
                                handleMedicineFieldChange(med.id, "start_date", e.target.value)
                              }
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between self-end">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-amber-950">
                                Urgent / STAT Order
                              </div>
                              <div className="text-[11px] text-amber-800/80">
                                Prioritize immediate dose
                              </div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={med.is_stat}
                            onChange={(e) =>
                              handleMedicineFieldChange(med.id, "is_stat", e.target.checked)
                            }
                            className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                          />
                        </div>
                      </div>

                      {/* 6. Administration Instructions */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          8. Administration Instructions (e.g. Take with food, monitor BP)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Take immediately after meals with plenty of water. Withhold if systolic BP < 100."
                          value={med.instructions}
                          onChange={(e) =>
                            handleMedicineFieldChange(med.id, "instructions", e.target.value)
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </Card>
                )
              })}

              {/* + ADD ANOTHER MEDICINE BUTTON */}
              <div className="flex items-center justify-between p-4 bg-white border border-dashed border-sky-300 rounded-2xl shadow-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Need to prescribe multiple medications?
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add as many items as clinically required in this order, each with independent dosing & timing.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  icon={Plus}
                  onClick={handleAddMedicine}
                >
                  + ADD ANOTHER MEDICINE
                </Button>
              </div>
            </div>

            {/* Overall Order Summary Card */}
            <Card>
              <CardHeader
                title="Prescription Order Summary"
                subtitle="Review all prescribed medications and estimated dosing schedules"
              />
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Medicines</span>
                    <span className="text-lg font-bold text-slate-800 mt-1 block">{medicines.length} Item(s)</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Planned Administrations</span>
                    <span className="text-lg font-bold text-sky-700 mt-1 block">{totalDosesAcrossAll} Doses</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Nurse Alerts</span>
                    <span className="text-lg font-bold text-emerald-700 mt-1 block">5 Min Pre-Dose</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Inventory Deductions</span>
                    <span className="text-lg font-bold text-slate-800 mt-1 block">0 (On Dispense)</span>
                  </div>
                </div>

                {/* Items Summary Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Medicine</th>
                        <th className="p-3">Dose & Route</th>
                        <th className="p-3">Frequency & Times</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Est. Doses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {medicines.map((m, i) => {
                        const medObj = medicinesCatalogue.find(
                          (c) => String(c.id) === String(m.medicine_id)
                        )
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-400">{i + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              {medObj ? `${medObj.name} ${medObj.strength ? `(${medObj.strength})` : ""}` : "Unselected"}
                            </td>
                            <td className="p-3">{m.dose || "—"} · {m.route}</td>
                            <td className="p-3">
                              {m.frequency}
                              {m.administration_times?.length > 0 && (
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {m.administration_times.join(", ")}
                                </div>
                              )}
                            </td>
                            <td className="p-3">{m.duration_days} Days</td>
                            <td className="p-3 font-bold text-sky-700">{calculateDoseCount(m)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Physician Notes */}
                <div>
                  <label
                    htmlFor="order_notes"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2"
                  >
                    Clinical Order Notes (Optional)
                  </label>
                  <textarea
                    id="order_notes"
                    rows={2}
                    placeholder="Confidential order rationale, treatment goal or physician reference notes..."
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* INPATIENT ADMISSION & BED ASSIGNMENT */}
            <Card>
              <CardHeader
                title="INPATIENT ADMISSION & BED ASSIGNMENT"
                subtitle="Assign hospital ward and unoccupied bed for this patient during care order"
              />
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    INPATIENT ADMISSION NEEDED? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="admit_needed"
                        value="NO"
                        checked={admitNeeded === "NO"}
                        onChange={() => setAdmitNeeded("NO")}
                        className="text-sky-600 focus:ring-sky-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-700">NO (OUTPATIENT / MAINTAIN CURRENT)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="admit_needed"
                        value="YES"
                        checked={admitNeeded === "YES"}
                        onChange={() => {
                          setAdmitNeeded("YES")
                          if (wards.length === 0) loadWardsData()
                        }}
                        className="text-sky-600 focus:ring-sky-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-700">YES (INPATIENT ADMISSION & BED ASSIGNMENT)</span>
                    </label>
                  </div>
                </div>

                {patient?.bed_id && (
                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>
                        Current Bed Assignment: <strong>Bed #{patient.bed_id}</strong>
                        {patient.ward_id && ` in Ward #${patient.ward_id}`}
                      </span>
                    </div>
                    <Badge variant="success" size="sm">CURRENTLY ADMITTED</Badge>
                  </div>
                )}

                {currentAssignedNurse && (
                  <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>
                        Current Assigned Nurse: <strong>{currentAssignedNurse.nurse_name}</strong>
                        {currentAssignedNurse.nurse_username && (
                          <span className="text-teal-700 font-mono"> (@{currentAssignedNurse.nurse_username})</span>
                        )}
                      </span>
                    </div>
                    <Badge variant="primary" size="sm">ACTIVE NURSE</Badge>
                  </div>
                )}

                {admitNeeded === "YES" && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fade-in">
                    {/* Ward Error Alert */}
                    {wardError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{wardError}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={RefreshCw}
                          onClick={loadWardsData}
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {/* Nurse Error Alert */}
                    {nurseError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{nurseError}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={RefreshCw}
                          onClick={loadNursesData}
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Ward Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            HOSPITAL WARD <span className="text-rose-500">*</span>
                          </label>
                          {loadingWards && (
                            <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> LOADING...
                            </span>
                          )}
                        </div>
                        <select
                          value={selectedWard}
                          onChange={(e) => handleWardChange(e.target.value)}
                          disabled={loadingWards}
                          required={admitNeeded === "YES"}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:opacity-50"
                        >
                          <option value="">
                            {loadingWards
                              ? "LOADING HOSPITAL WARDS..."
                              : wards.length === 0
                              ? "-- NO WARDS CONFIGURED --"
                              : "-- SELECT HOSPITAL WARD --"}
                          </option>
                          {wards.map((w) => {
                            const availCount = w.available_beds ?? (w.total_beds - (w.occupied_beds || 0))
                            return (
                              <option key={w.id} value={w.id}>
                                {w.name?.toUpperCase()} {w.code ? `(${w.code})` : ""} — {availCount} Beds Available / {w.total_beds} Total
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      {/* Bed Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            UNOCCUPIED BED <span className="text-rose-500">*</span>
                          </label>
                          {loadingBeds && (
                            <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> LOADING BEDS...
                            </span>
                          )}
                        </div>
                        <select
                          value={selectedBed}
                          onChange={(e) => setSelectedBed(e.target.value)}
                          disabled={!selectedWard || loadingBeds || loadingWards}
                          required={admitNeeded === "YES"}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:opacity-50"
                        >
                          <option value="">
                            {loadingBeds
                              ? "LOADING AVAILABLE BEDS..."
                              : !selectedWard
                              ? "-- SELECT HOSPITAL WARD FIRST --"
                              : isAuthError
                              ? "-- SESSION EXPIRED (LOGIN REQUIRED) --"
                              : bedApiError
                              ? "-- ERROR LOADING BEDS (CLICK RETRY) --"
                              : availableBeds.length === 0
                              ? "-- NO AVAILABLE BEDS IN THIS WARD --"
                              : "-- SELECT UNOCCUPIED BED --"}
                          </option>
                          {availableBeds.map((b) => (
                            <option key={b.id} value={b.id}>
                              BED {b.bed_number} — AVAILABLE
                            </option>
                          ))}
                        </select>

                        {/* Genuinely empty ward with 0 beds available (No error) */}
                        {selectedWard && !loadingBeds && !bedApiError && availableBeds.length === 0 && (
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>NO AVAILABLE BEDS IN THIS WARD. PLEASE SELECT ANOTHER WARD.</span>
                          </div>
                        )}

                        {/* Session Expired / Authentication Failure */}
                        {isAuthError && (
                          <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                              <div>
                                <span className="font-bold uppercase tracking-wider block">SESSION EXPIRED / AUTHENTICATION REQUIRED</span>
                                <span className="text-rose-700">{bedApiError}</span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                localStorage.removeItem("smartmedchart_token")
                                localStorage.removeItem("smartmedchart_user")
                                window.location.href = "/login"
                              }}
                              className="shrink-0 font-bold uppercase tracking-wider"
                            >
                              Sign In Again
                            </Button>
                          </div>
                        )}

                        {/* General API / Network Error */}
                        {!isAuthError && bedApiError && (
                          <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>{bedApiError}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleWardChange(selectedWard)}
                              className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 shrink-0 uppercase tracking-wider text-[11px]"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Nurse Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            ASSIGN NURSE <span className="text-rose-500">*</span>
                          </label>
                          {loadingNurses && (
                            <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> LOADING NURSES...
                            </span>
                          )}
                        </div>

                        {nurses.length > 3 && (
                          <div className="relative mb-1.5">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search nurse..."
                              value={nurseSearchTerm}
                              onChange={(e) => setNurseSearchTerm(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                            />
                          </div>
                        )}

                        <select
                          value={selectedNurse}
                          onChange={(e) => handleNurseChange(e.target.value)}
                          disabled={loadingNurses}
                          required={admitNeeded === "YES"}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:opacity-50"
                        >
                          <option value="">
                            {loadingNurses
                              ? "LOADING REGISTERED NURSES..."
                              : nurses.length === 0
                              ? "-- NO ACTIVE NURSES AVAILABLE --"
                              : "-- SELECT ASSIGNED NURSE --"}
                          </option>
                          {filteredNurses.map((n) => {
                            const isCurrent =
                              currentAssignedNurse &&
                              Number(currentAssignedNurse.nurse_id) === Number(n.id)
                            return (
                              <option key={n.id} value={n.id}>
                                {n.full_name?.toUpperCase()} (@{n.username})
                                {isCurrent ? " — (CURRENT ASSIGNMENT)" : ""}
                              </option>
                            )
                          })}
                        </select>

                        {/* Empty state when no active nurses are found */}
                        {!loadingNurses && !nurseError && nurses.length === 0 && (
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>NO ACTIVE NURSES REGISTERED. PLEASE CONTACT ADMINISTRATOR.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selection Review Banner */}
                    {selectedWard && selectedBed && selectedNurse && (
                      <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>
                            Selected: <strong>{wards.find((w) => String(w.id) === String(selectedWard))?.name?.toUpperCase()}</strong> · Bed <strong>#{availableBeds.find((b) => String(b.id) === String(selectedBed))?.bed_number || selectedBed}</strong> · Nurse: <strong>{nurses.find((n) => String(n.id) === String(selectedNurse))?.full_name?.toUpperCase() || `Nurse #${selectedNurse}`}</strong>
                          </span>
                        </div>
                        <Badge variant="primary" size="sm">READY TO ADMIT & ASSIGN</Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Action Footer */}
            <div className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(patientId ? `/doctor/patients/${patientId}` : "/doctor/patients")
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                loading={submitting}
                disabled={
                  submitting ||
                  medicines.length === 0 ||
                  !(selectedPatientId || patientId) ||
                  (admitNeeded === "YES" && (!selectedWard || !selectedBed || !selectedNurse))
                }
              >
                Authorize & Create Prescription ({medicines.length} Medicines)
              </Button>
            </div>
          </form>
        )}

        {/* Allergy Modal */}
        <Modal
          open={allergyModalOpen}
          isOpen={allergyModalOpen}
          onClose={closeAllergyModal}
          title={editingAllergy ? "EDIT PATIENT ALLERGY" : "RECORD DRUG / SUBSTANCE ALLERGY"}
          subtitle="Document a verified allergy or hypersensitivity to protect patient safety during prescribing."
          size="md"
        >
          <form onSubmit={handleSaveAllergy} className="space-y-4">
            {allergyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {allergyError}
              </div>
            )}

            <div>
              <label
                htmlFor="allergen"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                DRUG / ALLERGEN NAME <span className="text-rose-500">*</span>
              </label>
              <input
                id="allergen"
                name="allergen"
                type="text"
                required
                placeholder="E.G. PENICILLIN, SULFA DRUGS, PARACETAMOL"
                value={allergyForm.allergen}
                onChange={(e) =>
                  setAllergyForm((prev) => ({
                    ...prev,
                    allergen: e.target.value.toUpperCase(),
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase"
              />
            </div>

            <div>
              <label
                htmlFor="severity"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                CLINICAL SEVERITY
              </label>
              <select
                id="severity"
                name="severity"
                value={allergyForm.severity}
                onChange={(e) =>
                  setAllergyForm((prev) => ({ ...prev, severity: e.target.value }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase font-medium"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reaction"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                OBSERVED REACTION
              </label>
              <input
                id="reaction"
                name="reaction"
                type="text"
                placeholder="E.G. URTICARIA, RASH, ANAPHYLAXIS, WHEEZING"
                value={allergyForm.reaction}
                onChange={(e) =>
                  setAllergyForm((prev) => ({
                    ...prev,
                    reaction: e.target.value.toUpperCase(),
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                CLINICAL NOTES
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="ADDITIONAL DETAILS CONCERNING PREVIOUS EXPOSURE..."
                value={allergyForm.notes}
                onChange={(e) =>
                  setAllergyForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeAllergyModal}
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingAllergy}
              >
                RECORD ALLERGY
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </MainLayout>
  )
}
