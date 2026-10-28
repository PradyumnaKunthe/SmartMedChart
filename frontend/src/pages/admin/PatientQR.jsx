import {
  Download,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  QRCodeCanvas,
} from "qrcode.react"

import MainLayout from "../../components/layout/MainLayout"

import {
  getAdminPatients,
  generatePatientQR,
} from "../../services/admin"

import {
  hideTestPatients,
} from "../../utils/patientFilter"


export default function PatientQR() {
  const [
    patients,
    setPatients,
  ] = useState([])

  const [
    search,
    setSearch,
  ] = useState("")

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    generatingId,
    setGeneratingId,
  ] = useState(null)

  const [
    error,
    setError,
  ] = useState("")

  const [
    generatedQR,
    setGeneratedQR,
  ] = useState(null)

  const qrCanvasRef = useRef(null)


  async function loadPatients() {
    setLoading(true)
    setError("")

    try {
      const response =
        await getAdminPatients()

      const rawPatients =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.patients)
            ? response.patients
            : []

      setPatients(
        hideTestPatients(rawPatients),
      )
    } catch (requestError) {
      console.error(
        "Unable to load patients:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to load patients.",
      )

      setPatients([])
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadPatients()
  }, [])


  const filteredPatients =
    useMemo(() => {
      const query =
        search.trim().toLowerCase()

      if (!query) {
        return patients
      }

      return patients.filter(
        (patient) => {
          const fullName =
            patient.full_name ||
            `${patient.first_name || ""} ${
              patient.last_name || ""
            }`

          return (
            String(fullName)
              .toLowerCase()
              .includes(query) ||
            String(
              patient.patient_id || "",
            )
              .toLowerCase()
              .includes(query)
          )
        },
      )
    },
    [
      patients,
      search,
    ])


  async function handleGenerateQR(
    patient,
  ) {
    setGeneratingId(patient.id)
    setError("")
    setGeneratedQR(null)

    try {
      const result =
        await generatePatientQR(
          patient.id,
        )

      setGeneratedQR({
        ...result,
        patient,
      })
    } catch (requestError) {
      console.error(
        "QR generation failed:",
        requestError,
      )

      setError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to generate patient QR.",
      )
    } finally {
      setGeneratingId(null)
    }
  }


  function downloadQR() {
    const canvas =
      qrCanvasRef.current

    if (!canvas) {
      setError(
        "QR image is not available.",
      )
      return
    }

    const image =
      canvas.toDataURL("image/png")

    const patient =
      generatedQR?.patient

    const patientName =
      patient?.full_name ||
      `${patient?.first_name || "patient"} ${
        patient?.last_name || ""
      }`

    const link =
      document.createElement("a")

    link.href = image

    link.download =
      `${patientName
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase()}_qr.png`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }


  function closeQR() {
    setGeneratedQR(null)
  }


  return (
    <MainLayout title="Patient QR">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-xl">

          <div className="p-6 sm:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10">

                <QrCode className="h-6 w-6 text-cyan-400" />

              </div>

              <div className="min-w-0">

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                  Patient Security
                </p>

                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  Patient QR Management
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Generate and download a secure QR code
                  for an active patient.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">

            {error}

          </div>

        )}


        {/* =====================================================
            SEARCH
        ===================================================== */}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="relative">

            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search patient name or patient ID..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
            />

          </div>

        </section>


        {/* =====================================================
            PATIENT LIST
        ===================================================== */}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                Active Patients
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Generate Patient QR
              </h2>

            </div>


            <button
              type="button"
              onClick={loadPatients}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <RefreshCw
                className={
                  loading
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />

              Refresh

            </button>

          </div>


          {loading ? (

            <div className="flex min-h-56 items-center justify-center">

              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />

            </div>

          ) : filteredPatients.length === 0 ? (

            <div className="p-12 text-center">

              <UserRound className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-4 font-semibold text-slate-700">
                No patients found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try a different patient name or patient ID.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100">

              {filteredPatients.map(
                (patient) => {

                  const patientName =
                    patient.full_name ||
                    `${patient.first_name || ""} ${
                      patient.last_name || ""
                    }`

                  return (
                    <div
                      key={patient.id}
                      className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50">

                          <UserRound className="h-5 w-5 text-cyan-600" />

                        </div>


                        <div className="min-w-0">

                          <p className="truncate font-bold text-slate-900">
                            {patientName}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Patient ID:{" "}
                            {patient.patient_id}
                          </p>

                        </div>

                      </div>


                      <button
                        type="button"
                        disabled={
                          generatingId ===
                          patient.id
                        }
                        onClick={() =>
                          handleGenerateQR(
                            patient,
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >

                        {generatingId ===
                        patient.id ? (

                          <LoaderCircle className="h-4 w-4 animate-spin" />

                        ) : (

                          <QrCode className="h-4 w-4" />

                        )}

                        {generatingId ===
                        patient.id
                          ? "Generating..."
                          : "Generate QR"}

                      </button>

                    </div>
                  )
                },
              )}

            </div>

          )}

        </section>


        {/* =====================================================
            QR MODAL
        ===================================================== */}

        {generatedQR && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">

            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">

              <div className="flex items-center justify-between border-b border-slate-200 p-5">

                <div className="min-w-0">

                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-600">
                    QR Generated
                  </p>

                  <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
                    {generatedQR.patient?.full_name ||
                      `${generatedQR.patient?.first_name || ""} ${
                        generatedQR.patient?.last_name || ""
                      }`}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Patient ID:{" "}
                    {generatedQR.patient?.patient_id}
                  </p>

                </div>


                <button
                  type="button"
                  onClick={closeQR}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close QR preview"
                >

                  <X className="h-5 w-5" />

                </button>

              </div>


              <div className="p-6">

                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-5">

                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={
                      generatedQR.qr_data ||
                      generatedQR.qr_token
                    }
                    size={240}
                    level="H"
                    includeMargin
                  />

                </div>


                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                  <div className="flex items-start gap-3">

                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                    <div>

                      <p className="text-sm font-semibold text-emerald-900">
                        Secure QR created successfully
                      </p>

                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        This QR is linked to the selected
                        patient and can be used for nurse
                        patient verification.
                      </p>

                    </div>

                  </div>

                </div>


                <button
                  type="button"
                  onClick={downloadQR}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >

                  <Download className="h-4 w-4" />

                  Download QR

                </button>

              </div>

            </div>

          </div>

        )}

      </div>

    </MainLayout>
  )
}