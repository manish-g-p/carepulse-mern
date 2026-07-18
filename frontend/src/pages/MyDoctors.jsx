import { useEffect, useState } from "react";

import RecordsNav from "../components/RecordsNav.jsx";
import { addMyDoctor, deleteMyDoctor, listMyDoctors, updateMyDoctor } from "../lib/api";

const emptyForm = {
  name: "",
  specialization: "",
  phone: "",
  email: "",
  hospital: "",
  address: "",
  notes: "",
};

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

// Personal doctor directory: add/edit/delete, search, filter by specialization.
const MyDoctors = () => {
  const [doctors, setDoctors] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = (params = {}) => {
    listMyDoctors(params)
      .then(setDoctors)
      .catch(() => setError("Failed to load doctors."));
  };

  useEffect(() => {
    load();
  }, []);

  const search = (event) => {
    event.preventDefault();
    load({ ...(q && { q }), ...(specialization && { specialization }) });
  };

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const startEdit = (doctor) => {
    setEditingId(doctor._id);
    setForm({
      name: doctor.name,
      specialization: doctor.specialization,
      phone: doctor.phone,
      email: doctor.email,
      hospital: doctor.hospital,
      address: doctor.address,
      notes: doctor.notes,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        await updateMyDoctor(editingId, form);
      } else {
        await addMyDoctor(form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save doctor.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doctor) => {
    if (!window.confirm(`Remove ${doctor.name} from your directory?`)) return;
    try {
      await deleteMyDoctor(doctor._id);
      load();
    } catch {
      setError("Failed to delete doctor.");
    }
  };

  const specializations = [...new Set((doctors || []).map((d) => d.specialization).filter(Boolean))];

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <h1 className="header">Doctors</h1>
        {error && <p className="shad-error text-14-regular">{error}</p>}

        <section className="space-y-3 rounded-lg border border-dark-500 p-4">
          <h2 className="text-16-semibold">{editingId ? "Edit doctor" : "Add a doctor"}</h2>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <input className={inputClass} placeholder="Name *" value={form.name} onChange={set("name")} required />
            <input className={inputClass} placeholder="Specialization" value={form.specialization} onChange={set("specialization")} />
            <input className={inputClass} placeholder="Phone" value={form.phone} onChange={set("phone")} />
            <input className={inputClass} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
            <input className={inputClass} placeholder="Hospital / clinic" value={form.hospital} onChange={set("hospital")} />
            <input className={inputClass} placeholder="Address" value={form.address} onChange={set("address")} />
            <textarea
              className="shad-textArea w-full rounded-md border bg-dark-400 p-3 text-white placeholder:text-dark-600 md:col-span-2"
              placeholder="Notes"
              rows={2}
              value={form.notes}
              onChange={set("notes")}
            />
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" disabled={saving} className="shad-primary-btn rounded-md px-4 py-2">
                {saving ? "Saving..." : editingId ? "Save changes" : "Add doctor"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="shad-gray-btn rounded-md px-4 py-2">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="space-y-3">
          <form onSubmit={search} className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Search name, hospital, email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="shad-select-trigger rounded-md border bg-dark-400 px-3 text-white"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
            >
              <option value="">All specializations</option>
              {specializations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="shad-gray-btn rounded-md px-4 py-2">
              Search
            </button>
          </form>

          {!doctors && !error && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {doctors?.length === 0 && (
            <p className="text-dark-600 text-14-regular">No doctors in your directory yet.</p>
          )}
          <ul className="space-y-2">
            {doctors?.map((doctor) => (
              <li
                key={doctor._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dark-500 p-3 text-14-regular"
              >
                <div>
                  <p className="text-16-semibold">{doctor.name}</p>
                  <p className="text-dark-700">
                    {[doctor.specialization, doctor.hospital].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-dark-600">
                    {[doctor.phone, doctor.email].filter(Boolean).join(" · ")}
                  </p>
                  {doctor.notes && <p className="text-dark-600">{doctor.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(doctor)} className="shad-gray-btn rounded-md px-3 py-1">
                    Edit
                  </button>
                  <button onClick={() => remove(doctor)} className="shad-danger-btn rounded-md px-3 py-1">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default MyDoctors;
