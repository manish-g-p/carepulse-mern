import { useEffect, useState } from "react";

import RecordsNav from "../components/RecordsNav.jsx";
import { deleteDocument, getDocumentUrl, listDocuments, uploadDocument } from "../lib/api";

const CATEGORIES = ["Lab Report", "Prescription", "Bill", "Insurance", "Other"];

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

// Medical documents: upload (Cloudinary or local fallback -- the server
// decides), categorize, preview, download, delete.
const Documents = () => {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = (cat = filter) => {
    listDocuments(cat || undefined)
      .then(setDocuments)
      .catch(() => setError("Failed to load documents."));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return setError("Choose a file first.");
    setError("");
    setUploading(true);
    try {
      await uploadDocument(file, title, category);
      setTitle("");
      setCategory("Other");
      setFile(null);
      event.target.reset();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    try {
      await deleteDocument(doc._id);
      if (preview?._id === doc._id) setPreview(null);
      load();
    } catch {
      setError("Failed to delete document.");
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <h1 className="header">Documents</h1>
        {error && <p className="shad-error text-14-regular">{error}</p>}

        <section className="space-y-3 rounded-lg border border-dark-500 p-4">
          <h2 className="text-16-semibold">Upload a document</h2>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <input className={inputClass} placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select
              className="shad-select-trigger rounded-md border bg-dark-400 px-3 text-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.svg,.webp,.pdf"
              className="text-14-regular text-dark-700"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            <button type="submit" disabled={uploading} className="shad-primary-btn rounded-md px-4 py-2 md:col-span-3 md:w-fit">
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("")}
              className={`rounded-md px-3 py-1 text-14-regular ${filter === "" ? "bg-green-500 text-white" : "bg-dark-400 text-dark-700"}`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-md px-3 py-1 text-14-regular ${filter === c ? "bg-green-500 text-white" : "bg-dark-400 text-dark-700"}`}
              >
                {c}
              </button>
            ))}
          </div>

          {!documents && !error && <p className="text-dark-600 text-14-regular">Loading...</p>}
          {documents?.length === 0 && (
            <p className="text-dark-600 text-14-regular">No documents uploaded yet.</p>
          )}
          <ul className="space-y-2">
            {documents?.map((doc) => (
              <li
                key={doc._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dark-500 p-3 text-14-regular"
              >
                <div>
                  <p className="text-16-semibold">{doc.title}</p>
                  <p className="text-dark-700">
                    {doc.category} · {(doc.size / 1024).toFixed(0)} KB ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreview(preview?._id === doc._id ? null : doc)}
                    className="shad-gray-btn rounded-md px-3 py-1"
                  >
                    {preview?._id === doc._id ? "Hide" : "Preview"}
                  </button>
                  <a
                    href={getDocumentUrl(doc)}
                    target="_blank"
                    rel="noreferrer"
                    download={doc.originalName || doc.title}
                    className="shad-gray-btn rounded-md px-3 py-1"
                  >
                    Download
                  </a>
                  <button onClick={() => remove(doc)} className="shad-danger-btn rounded-md px-3 py-1">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {preview && (
            <div className="rounded-lg border border-dark-500 p-4">
              <p className="text-16-semibold mb-2">{preview.title}</p>
              {preview.mimeType === "application/pdf" ? (
                <iframe title={preview.title} src={getDocumentUrl(preview)} className="h-[600px] w-full rounded-md" />
              ) : (
                <img src={getDocumentUrl(preview)} alt={preview.title} className="max-h-[600px] rounded-md" />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Documents;
