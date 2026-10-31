import { useEffect, useState } from "react";
import MainLayout from "../../components/layout/MainLayout";
import {
  getCareMatchDoctors,
  saveCareMatchDoctorProfile,
} from "../../services/admin";

// These are common starting options.
// Search lets an administrator add additional values when needed.

const QUALIFICATIONS = [
  "MBBS", "MD", "MS", "DNB", "DM", "MCh",
  "DNB Super Specialty", "BDS", "MDS", "BAMS",
  "BHMS", "BUMS", "BNYS", "BPT", "MPT",
  "PharmD", "MRCP", "FRCS", "Fellowship",
];

const SPECIALIZATIONS = [
  "General Medicine", "Internal Medicine", "Family Medicine",
  "Cardiology", "Cardiothoracic Surgery", "Neurology",
  "Neurosurgery", "Orthopedics", "Rheumatology",
  "Pediatrics", "Neonatology", "Obstetrics and Gynecology",
  "Fertility and IVF", "Dermatology", "Psychiatry",
  "Ophthalmology", "ENT", "Pulmonology",
  "Respiratory Medicine", "Gastroenterology", "Hepatology",
  "Nephrology", "Urology", "Endocrinology", "Diabetology",
  "Medical Oncology", "Surgical Oncology", "Hematology",
  "Infectious Diseases", "Emergency Medicine", "Critical Care",
  "Anesthesiology", "Radiology", "Interventional Radiology",
  "Pathology", "General Surgery", "Plastic Surgery",
  "Vascular Surgery", "Pediatric Surgery", "Geriatrics",
  "Palliative Medicine", "Pain Medicine",
  "Physical Medicine and Rehabilitation",
  "Allergy and Immunology", "Dentistry", "Oral Surgery",
  "Ayurveda", "Homeopathy",
];

const EXPERTISE = [
  "Fever", "Cough", "Cold", "Sore Throat",
  "Headache", "Migraine", "Dizziness",
  "Chest Pain", "Palpitations", "High Blood Pressure",
  "Low Blood Pressure", "Diabetes", "Thyroid Disorders",
  "Abdominal Pain", "Acidity", "Acid Reflux",
  "Diarrhea", "Constipation", "Vomiting",
  "Liver Disease", "Kidney Disease", "Urinary Tract Infection",
  "Back Pain", "Neck Pain", "Joint Pain", "Arthritis",
  "Fractures", "Sports Injuries", "Muscle Pain",
  "Skin Rash", "Acne", "Hair Loss", "Eczema",
  "Allergies", "Asthma", "Breathing Difficulty",
  "Sinusitis", "Ear Pain", "Hearing Problems",
  "Vision Problems", "Eye Infection",
  "Pregnancy Care", "Menstrual Problems", "Infertility",
  "Child Health", "Vaccination", "Growth and Development",
  "Depression", "Anxiety", "Sleep Disorders",
  "Seizures", "Stroke", "Memory Problems",
  "Cancer Screening", "Cancer Care", "Wound Care",
  "Obesity", "Nutrition", "Preventive Health",
  "Routine Checkup", "Infection", "Postoperative Care",
  "Dental Pain", "Gum Disease", "Oral Health",
];

const LANGUAGES = [
  "English", "Hindi", "Marathi", "Bengali",
  "Gujarati", "Tamil", "Telugu", "Kannada",
  "Malayalam", "Punjabi", "Urdu", "Odia",
  "Assamese", "Nepali", "Konkani", "Sanskrit",
  "Manipuri", "Bodo", "Dogri", "Kashmiri",
  "Maithili", "Santali", "Sindhi",
  "Spanish", "French", "Arabic", "Portuguese",
  "Chinese", "Russian", "Japanese",
];

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
];

const EMPTY_FORM = {
  qualifications: [],
  specializations: [],
  experience_years: "0",
  expertise_keywords: [],
  languages: [],
  consultation_fee: "",
  available_days: [],
  is_available: true,
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100";

const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500";

function toList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

// Searchable dropdown with multiple selections and optional custom values.
function MultiSelectDropdown({
  id,
  label,
  placeholder,
  options,
  selectedValues,
  onChange,
  allowCustom = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const customValue = search.trim();

  const alreadyExists = selectedValues.some(
    (item) => item.toLowerCase() === customValue.toLowerCase(),
  );

  function toggleOption(option) {
    const selected = selectedValues.some(
      (item) => item.toLowerCase() === option.toLowerCase(),
    );

    onChange(
      selected
        ? selectedValues.filter(
            (item) => item.toLowerCase() !== option.toLowerCase(),
          )
        : [...selectedValues, option],
    );
  }

  function addCustomValue() {
    if (!customValue || alreadyExists) {
      return;
    }

    onChange([...selectedValues, customValue]);
    setSearch("");
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-search`} className={labelClass}>
        {label}
      </label>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex items-center justify-between gap-3 text-left`}
      >
        <span className="truncate">
          {selectedValues.length
            ? `${selectedValues.length} selected`
            : placeholder}
        </span>

        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
        >
          <input
            id={`${id}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className={inputClass}
          />

          <div className="mt-2 max-h-52 overflow-y-auto">
            {filteredOptions.map((option) => {
              const checked = selectedValues.some(
                (item) => item.toLowerCase() === option.toLowerCase(),
              );

              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-cyan-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                    className="h-4 w-4 accent-cyan-700"
                  />
                  <span>{option}</span>
                </label>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="p-3 text-sm text-slate-500">
                No matching options found.
              </p>
            )}
          </div>

          {allowCustom && customValue && !alreadyExists && (
            <button
              type="button"
              onClick={addCustomValue}
              className="mt-2 w-full rounded-lg bg-cyan-50 px-3 py-2 text-left text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
            >
              + Add custom value: "{customValue}"
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
            className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      )}

      {selectedValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900"
            >
              {value}

              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => toggleOption(value)}
                className="ml-1 font-bold hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-slate-500 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function profileToForm(doctor) {
  const profile = doctor?.profile || {};

  return {
    qualifications: toList(profile.qualifications),
    specializations: toList(profile.specializations),
    experience_years: String(profile.experience_years ?? 0),
    expertise_keywords: toList(profile.expertise_keywords),
    languages: toList(profile.languages),
    consultation_fee:
      profile.consultation_fee == null
        ? ""
        : String(profile.consultation_fee),
    available_days: toList(profile.available_days),
    is_available: profile.is_available ?? true,
  };
}

export default function DoctorProfiles() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadDoctors() {
    setLoading(true);
    setError("");

    try {
      const response = await getCareMatchDoctors();
      const list = Array.isArray(response?.doctors)
        ? response.doctors
        : [];

      setDoctors(list);

      if (list.length) {
        setSelectedDoctorId(String(list[0].id));
        setForm(profileToForm(list[0]));
      } else {
        setSelectedDoctorId("");
        setForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          "Could not load doctors. Check your login and backend connection.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  const selectedDoctor = doctors.find(
    (doctor) => String(doctor.id) === selectedDoctorId,
  );

  function handleDoctorChange(event) {
    const id = event.target.value;
    const doctor = doctors.find((item) => String(item.id) === id);

    setSelectedDoctorId(id);
    setForm(profileToForm(doctor));
    setSuccess("");
    setError("");
  }

 
async function handleSubmit(event) {
  event.preventDefault();
  setError("");
  setSuccess("");

  if (!selectedDoctorId) {
    setError("Select a doctor first.");
    return;
  }

  const experience = Number(form.experience_years);
  const fee =
    form.consultation_fee.trim() === ""
      ? null
      : Number(form.consultation_fee);

  if (
    !Number.isInteger(experience) ||
    experience < 0 ||
    experience > 80
  ) {
    setError("Experience must be a whole number from 0 to 80.");
    return;
  }

  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
    setError("Enter a valid consultation fee.");
    return;
  }

  const payload = {
    qualifications: form.qualifications.join(", "),
    specializations: form.specializations,
    experience_years: experience,
    expertise_keywords: form.expertise_keywords,
    languages: form.languages,
    consultation_fee: fee,
    available_days: form.available_days,
    is_available: form.is_available,
  };

  const savedDoctorId = String(selectedDoctorId);
  const savedDoctorName =
    selectedDoctor?.full_name || "the selected doctor";

  setSaving(true);

  try {
    // Save current doctor's profile
    const response = await saveCareMatchDoctorProfile(
      Number(savedDoctorId),
      payload,
    );

    // Immediately update the saved doctor locally
    setDoctors((current) =>
      current.map((doctor) =>
        String(doctor.id) === savedDoctorId
          ? {
              ...doctor,
              profile: response.profile,
              profile_configured: true,
            }
          : doctor,
      ),
    );

    // Refresh doctor list from backend
    try {
      const refreshedResponse = await getCareMatchDoctors();

      const refreshedDoctors = Array.isArray(
        refreshedResponse?.doctors
      )
        ? refreshedResponse.doctors
        : [];

      setDoctors(refreshedDoctors);

      // Search for the next unconfigured doctor
      const currentIndex = refreshedDoctors.findIndex(
        (doctor) => String(doctor.id) === savedDoctorId
      );

      const orderedDoctors = [
        ...refreshedDoctors.slice(currentIndex + 1),
        ...refreshedDoctors.slice(0, currentIndex + 1),
      ];

      const nextDoctor = orderedDoctors.find(
        (doctor) =>
          String(doctor.id) !== savedDoctorId &&
          !doctor.profile_configured
      );

      if (nextDoctor) {
        // Automatically select next doctor
        setSelectedDoctorId(String(nextDoctor.id));

        // Start with a clean form
        setForm(EMPTY_FORM);

        setSuccess(
          `Profile saved successfully for ${savedDoctorName}. Now complete ${nextDoctor.full_name}'s profile.`
        );
      } else {
        // All profiles have been configured
        setSelectedDoctorId(savedDoctorId);
        setForm(profileToForm({ profile: response.profile }));

        setSuccess(
          `Profile saved successfully for ${savedDoctorName}. All registered doctors have configured profiles.`
        );
      }
    } catch (refreshError) {
      console.error("Doctor list refresh error:", refreshError);

      setForm(profileToForm({ profile: response.profile }));

      setSuccess(
        `Profile saved successfully for ${savedDoctorName}, but the doctor list could not refresh. Please refresh the page.`
      );
    }
  } catch (requestError) {
    setError(
      requestError?.response?.data?.detail ||
        "Could not save the profile. Check your permissions and MongoDB."
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <MainLayout title="CareMatch Doctor Profiles">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-cyan-700">
            SMARTMEDCHART · CAREMATCH
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Doctor Profiles
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use standardized professional tags to help CareMatch compare
            patient visit reasons with registered doctor expertise.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Select registered doctor
          </h2>

          {loading ? (
            <p className="mt-3 text-sm text-slate-500">
              Loading doctors...
            </p>
          ) : doctors.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              No active doctors found. Create a Doctor account in Staff
              Management first.
            </p>
          ) : (
            <>
              <label
                htmlFor="carematch-doctor"
                className={`${labelClass} mt-4`}
              >
                Doctor account
              </label>

              <select
                id="carematch-doctor"
                value={selectedDoctorId}
                onChange={handleDoctorChange}
                className={inputClass}
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name} ({doctor.username})
                    {doctor.profile_configured ? " — Profile configured" : ""}
                  </option>
                ))}
              </select>

              {selectedDoctor && (
                <p className="mt-3 text-sm text-slate-500">
                  {selectedDoctor.email} · Doctor ID: {selectedDoctor.id}
                </p>
              )}
            </>
          )}
        </section>

        {!loading && doctors.length > 0 && (
          <form
            onSubmit={handleSubmit}
            className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Professional information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select multiple options. Search to find an option or add a
                custom value.
              </p>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              <MultiSelectDropdown
                id="qualifications"
                label="Qualifications"
                placeholder="Select qualifications"
                options={QUALIFICATIONS}
                selectedValues={form.qualifications}
                onChange={(value) => updateField("qualifications", value)}
              />

              <MultiSelectDropdown
                id="specializations"
                label="Specializations"
                placeholder="Select specializations"
                options={SPECIALIZATIONS}
                selectedValues={form.specializations}
                onChange={(value) => updateField("specializations", value)}
              />

              <div>
                <label htmlFor="experience_years" className={labelClass}>
                  Years of experience
                </label>

                <input
                  id="experience_years"
                  type="number"
                  name="experience_years"
                  min="0"
                  max="80"
                  step="1"
                  required
                  value={form.experience_years}
                  onChange={(event) =>
                    updateField("experience_years", event.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="consultation_fee" className={labelClass}>
                  Consultation fee (₹)
                </label>

                <input
                  id="consultation_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.consultation_fee}
                  onChange={(event) =>
                    updateField("consultation_fee", event.target.value)
                  }
                  placeholder="e.g. 500"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <MultiSelectDropdown
                  id="expertise"
                  label="Expertise and clinical keywords"
                  placeholder="Select expertise keywords"
                  options={EXPERTISE}
                  selectedValues={form.expertise_keywords}
                  onChange={(value) =>
                    updateField("expertise_keywords", value)
                  }
                />
                <p className="mt-2 text-xs text-slate-500">
                  Choose keywords related to the conditions and concerns the
                  doctor manages. This list supports routing, not diagnosis.
                </p>
              </div>

              <MultiSelectDropdown
                id="languages"
                label="Languages spoken"
                placeholder="Select languages"
                options={LANGUAGES}
                selectedValues={form.languages}
                onChange={(value) => updateField("languages", value)}
              />

              <MultiSelectDropdown
                id="available-days"
                label="Available days"
                placeholder="Select available days"
                options={DAYS}
                selectedValues={form.available_days}
                onChange={(value) => updateField("available_days", value)}
                allowCustom={false}
              />

              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={(event) =>
                      updateField("is_available", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-cyan-700"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Available for CareMatch recommendations
                    </span>

                    <span className="mt-1 block text-xs text-slate-500">
                      This setting controls recommendations, not the doctor's
                      login account.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 p-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setForm(profileToForm(selectedDoctor))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Reset changes
              </button>

              <button
                type="submit"
                disabled={saving || !selectedDoctorId}
                className="rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save doctor profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
}