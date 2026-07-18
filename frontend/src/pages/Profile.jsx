import { useEffect, useState } from "react";

import RecordsNav from "../components/RecordsNav.jsx";
import { getMyProfile, updateMyProfile } from "../lib/api";

const inputClass =
  "shad-input w-full rounded-md border bg-dark-400 px-3 text-white placeholder:text-dark-600";

// Profile management for the signed-in account: name, specialization, and
// password change (email is the login identifier and stays fixed).
const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setSpecialization(p.specialization || "");
      })
      .catch(() => setError("Failed to load your profile."));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setSaving(true);
    try {
      const payload = { name, specialization };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const { token, doctor } = await updateMyProfile(payload);
      // Keep the session in sync with the renamed account.
      localStorage.setItem("doctorToken", token);
      localStorage.setItem("doctorInfo", JSON.stringify(doctor));
      setProfile((p) => ({ ...p, ...doctor }));
      setCurrentPassword("");
      setNewPassword("");
      setInfo("Profile updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col space-y-8 p-8">
      <RecordsNav />
      <main className="space-y-6">
        <h1 className="header">Profile</h1>
        {error && <p className="shad-error text-14-regular">{error}</p>}
        {info && <p className="text-14-regular text-green-500">{info}</p>}
        {!profile && !error && <p className="text-dark-600 text-14-regular">Loading...</p>}

        {profile && (
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-dark-500 p-4">
            <div>
              <label className="shad-input-label">Email (login, fixed)</label>
              <input className={`${inputClass} opacity-60`} value={profile.email} disabled />
            </div>
            <div>
              <label className="shad-input-label">Name</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="shad-input-label">Specialization</label>
              <input
                className={inputClass}
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />
            </div>
            <hr className="border-dark-500" />
            <p className="text-14-regular text-dark-700">
              Change password (leave blank to keep the current one)
            </p>
            <div>
              <label className="shad-input-label">Current password</label>
              <input
                type="password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="shad-input-label">New password (min 8 characters)</label>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={saving} className="shad-primary-btn rounded-md px-4 py-2">
              {saving ? "Saving..." : "Save changes"}
            </button>
            <p className="text-12-regular text-dark-600">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </form>
        )}
      </main>
    </div>
  );
};

export default Profile;
