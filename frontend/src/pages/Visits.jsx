import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import RecordsNav from "../components/RecordsNav.jsx";
import { createVisit, deleteVisit, listDocuments, listMyDoctors, listVisits, updateVisit } from "../lib/api";

const emptyForm = { doctor: "", date: "", reason: "", diagnosis: "", treatmentNotes: "", documents: [] };

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

// Medical visit history: record visits (linked to a directory doctor, with
// optional attached documents and treatment notes), edit, delete.
const Visits = () => {
  const [visits, setVisits] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    listVisits()
      .then(setVisits)
      .catch(() => setError("Failed to load visits."));
  };

  useEffect(() => {
    load();
    listMyDoctors().then(setDoctors).catch(() => {});
    listDocuments().then(setDocuments).catch(() => {});
  }, []);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const toggleDocument = (id) =>
    setForm((f) => ({
      ...f,
      documents: f.documents.includes(id)
        ? f.documents.filter((d) => d !== id)
        : [...f.documents, id],
    }));

  const startEdit = (visit) => {
    setEditingId(visit._id);
    setForm({
      doctor: visit.doctor?._id || "",
      date: visit.date.slice(0, 10),
      reason: visit.reason,
      diagnosis: visit.diagnosis,
      treatmentNotes: visit.treatmentNotes,
      documents: (visit.documents || []).map((d) => d._id),
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
        await updateVisit(editingId, form);
      } else {
        await createVisit(form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save visit.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (visit) => {
    if (!window.confirm("Delete this visit record?")) return;
    try {
      await deleteVisit(visit._id);
      load();
    } catch {
      setError("Failed to delete visit.");
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <h1 className="header">Medical visits</h1>
        {error && <p className="shad-error text-14-regular">{error}</p>}

        <section className="space-y-3 rounded-lg border border-dark-500 p-4">
          <h2 className="text-16-semibold">{editingId ? "Edit visit" : "Record a visit"}</h2>
          {doctors.length === 0 ? (
            <p className="text-dark-600 text-14-regular">
              Add a doctor to your <Link to="/doctor/doctors" className="text-green-500">directory</Link> first.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
              <select
                className="shad-select-trigger rounded-md border bg-dark-400 px-3 text-white"
                value={form.doctor}
                onChange={set("doctor")}
                required
              >
                <option value="">Select doctor *</option>
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.specialization ? ` (${d.specialization})` : ""}
                  </option>
                ))}
              </select>
              <input type="date" className={inputClass} value={form.date} onChange={set("date")} required />
              <input className={inputClass} placeholder="Reason for visit *" value={form.reason} onChange={set("reason")} required />
              <input className={inputClass} placeholder="Diagnosis" value={form.diagnosis} onChange={set("diagnosis")} />
              <textarea
                className="shad-textArea w-full rounded-md border bg-dark-400 p-3 text-white placeholder:text-dark-600 md:col-span-2"
                placeholder="Treatment notes"
                rows={3}
                value={form.treatmentNotes}
                onChange={set("treatmentNotes")}
              />
              {documents.length > 0 && (
                <div className="md:col-span-2">
                  <p className="shad-input-label mb-2">Attach documents</p>
                  <div className="flex flex-wrap gap-2">
                    {documents.map((doc) => (
                      <button
                        type="button"
                        key={doc._id}
                        onClick={() => toggleDocument(doc._id)}
                        className={`rounded-md px-3 py-1 text-12-regular ${
                          form.documents.includes(doc._id)
                            ? "bg-green-500 text-white"
                            : "bg-dark-400 text-dark-700"
                        }`}
                      >
                        {doc.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 md:col-span-2">
                <button type="submit" disabled={saving} className="shad-primary-btn rounded-md px-4 py-2">
                  {saving ? "Saving..." : editingId ? "Save changes" : "Record visit"}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="shad-gray-btn rounded-md px-4 py-2">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="sub-header">Visit history</h2>
          {!visits && !error && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {visits?.length === 0 && (
            <p className="text-dark-600 text-14-regular">No visits recorded yet.</p>
          )}
          <ul className="space-y-2">
            {visits?.map((visit) => (
              <li key={visit._id} className="space-y-1 rounded-md border border-dark-500 p-3 text-14-regular">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-16-semibold">
                    {visit.doctor?.name || "Unknown doctor"}
                    <span className="text-dark-600"> · {new Date(visit.date).toLocaleDateString()}</span>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(visit)} className="shad-gray-btn rounded-md px-3 py-1">
                      Edit
                    </button>
                    <button onClick={() => remove(visit)} className="shad-danger-btn rounded-md px-3 py-1">
                      Delete
                    </button>
                  </div>
                </div>
                <p>
                  <span className="text-dark-700">Reason:</span> {visit.reason}
                </p>
                {visit.diagnosis && (
                  <p>
                    <span className="text-dark-700">Diagnosis:</span> {visit.diagnosis}
                  </p>
                )}
                {visit.treatmentNotes && (
                  <p>
                    <span className="text-dark-700">Treatment:</span> {visit.treatmentNotes}
                  </p>
                )}
                {visit.documents?.length > 0 && (
                  <p className="text-dark-600">
                    Attached: {visit.documents.map((d) => d.title).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default Visits;
