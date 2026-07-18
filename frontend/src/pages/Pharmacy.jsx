import { useEffect, useState } from "react";

import RecordsNav from "../components/RecordsNav.jsx";
import { getDrugAlternatives, getPharmacyStatus, parsePrescription, searchDrugs } from "../lib/api";

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

const DrugCard = ({ drug, onAlternatives }) => {
  const [open, setOpen] = useState(false);
  const rows = [
    ["Generic name", drug.genericName],
    ["Manufacturer", drug.manufacturer],
    ["Route", drug.route],
    ["Purpose", drug.purpose],
    ["Indications", drug.indications],
    ["Dosage & administration", drug.dosage],
    ["Warnings", drug.warnings],
    ["Side effects", drug.sideEffects],
  ].filter(([, v]) => v);

  return (
    <li className="space-y-2 rounded-md border border-dark-500 p-3 text-14-regular">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-16-semibold">
          {drug.brandName || drug.genericName || "Unnamed product"}
          {drug.brandName && drug.genericName && (
            <span className="text-dark-600"> ({drug.genericName})</span>
          )}
        </p>
        <div className="flex gap-2">
          {onAlternatives && (drug.brandName || drug.genericName) && (
            <button
              onClick={() => onAlternatives(drug.brandName || drug.genericName)}
              className="shad-gray-btn rounded-md px-3 py-1"
            >
              Find alternatives
            </button>
          )}
          <button onClick={() => setOpen(!open)} className="shad-gray-btn rounded-md px-3 py-1">
            {open ? "Less" : "Details"}
          </button>
        </div>
      </div>
      {open && (
        <dl className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-dark-700 text-12-semibold uppercase">{label}</dt>
              <dd className="whitespace-pre-wrap text-dark-600">{value}</dd>
            </div>
          ))}
          {rows.length === 0 && <p className="text-dark-600">No further details on file.</p>}
        </dl>
      )}
    </li>
  );
};

// AI pharmacy assistant: prescription image parsing (Gemini, hidden when
// the server has no key), openFDA drug search, generic alternatives.
const Pharmacy = () => {
  const [parsingAvailable, setParsingAvailable] = useState(false);
  const [image, setImage] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [medications, setMedications] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [alternatives, setAlternatives] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPharmacyStatus()
      .then((s) => setParsingAvailable(s.prescriptionParsing))
      .catch(() => {});
  }, []);

  const parse = async (event) => {
    event.preventDefault();
    if (!image) return setError("Choose a prescription image first.");
    setError("");
    setParsing(true);
    setMedications(null);
    try {
      const { medications: meds } = await parsePrescription(image);
      setMedications(meds);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to parse the prescription.");
    } finally {
      setParsing(false);
    }
  };

  const runSearch = async (term) => {
    setError("");
    setSearching(true);
    setResults(null);
    setAlternatives(null);
    try {
      const { results: found } = await searchDrugs(term);
      setResults(found);
      setQuery(term);
    } catch (err) {
      setError(err.response?.data?.message || "Drug search failed.");
    } finally {
      setSearching(false);
    }
  };

  const search = (event) => {
    event.preventDefault();
    if (query.trim()) runSearch(query.trim());
  };

  const findAlts = async (name) => {
    setError("");
    setAlternatives(null);
    try {
      const result = await getDrugAlternatives(name);
      setAlternatives({ forName: name, ...result });
    } catch (err) {
      setError(err.response?.data?.message || "Alternative lookup failed.");
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-8">
        <h1 className="header">Pharmacy assistant 🤖</h1>
        <p className="text-dark-700 text-14-regular">
          Drug information comes from the public openFDA database. Extracted medication names are
          suggestions — always confirm against the original prescription.
        </p>
        {error && <p className="shad-error text-14-regular">{error}</p>}

        {parsingAvailable && (
          <section className="space-y-3 rounded-lg border border-dark-500 p-4">
            <h2 className="text-16-semibold">Parse a prescription image</h2>
            <form onSubmit={parse} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*"
                className="text-14-regular text-dark-700"
                onChange={(e) => setImage(e.target.files[0] || null)}
              />
              <button type="submit" disabled={parsing} className="shad-primary-btn rounded-md px-4 py-2">
                {parsing ? "Reading..." : "Extract medications"}
              </button>
            </form>
            {medications && medications.length === 0 && (
              <p className="text-dark-600 text-14-regular">No medications could be read from that image.</p>
            )}
            {medications && medications.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {medications.map((med, i) => (
                  <button
                    key={`${med.name}-${i}`}
                    onClick={() => runSearch(med.name)}
                    className="rounded-md bg-dark-400 px-3 py-2 text-14-regular text-white hover:bg-dark-500"
                    title="Search this medication"
                  >
                    {med.name}
                    {med.dosage && <span className="text-dark-600"> · {med.dosage}</span>}
                    {med.frequency && <span className="text-dark-600"> · {med.frequency}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="space-y-3 rounded-lg border border-dark-500 p-4">
          <h2 className="text-16-semibold">Search drug information</h2>
          <form onSubmit={search} className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-md`}
              placeholder="Brand or generic name (e.g. paracetamol)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" disabled={searching} className="shad-primary-btn rounded-md px-4 py-2">
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
          {results && results.length === 0 && (
            <p className="text-dark-600 text-14-regular">No matches in openFDA for that name.</p>
          )}
          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((drug, i) => (
                <DrugCard key={drug.id || i} drug={drug} onAlternatives={findAlts} />
              ))}
            </ul>
          )}
        </section>

        {alternatives && (
          <section className="space-y-3 rounded-lg border border-dark-500 p-4">
            <h2 className="text-16-semibold">
              Alternatives for {alternatives.forName}
              {alternatives.genericName && (
                <span className="text-dark-600"> (generic: {alternatives.genericName})</span>
              )}
            </h2>
            {alternatives.alternatives.length === 0 ? (
              <p className="text-dark-600 text-14-regular">
                No alternative products found for that ingredient.
              </p>
            ) : (
              <ul className="space-y-2">
                {alternatives.alternatives.map((drug, i) => (
                  <DrugCard key={drug.id || i} drug={drug} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default Pharmacy;
