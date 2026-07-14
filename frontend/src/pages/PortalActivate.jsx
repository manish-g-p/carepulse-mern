import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import CustomFormField, { FormFieldType } from "../components/CustomFormField";
import SubmitButton from "../components/SubmitButton";
import { patientActivate } from "../lib/api";
import { PortalActivateValidation } from "../lib/validation";
import { storePatientSession } from "./PortalLogin";

// Landing page for the invite link a doctor shares
// (/portal/activate?token=...). Setting a password here creates the portal
// account; re-using a fresh invite later resets the password.
const PortalActivate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token") || "";
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(PortalActivateValidation),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ password }) => {
    setIsLoading(true);
    setServerError("");

    try {
      const { token, patient } = await patientActivate(inviteToken, password);
      storePatientSession(token, patient);
      navigate("/portal/dashboard");
    } catch (error) {
      setServerError(
        error.response?.data?.message || "Failed to activate your account. Ask for a new invite."
      );
    }

    setIsLoading(false);
  };

  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[496px]">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="mb-12 h-10 w-fit" />

          {!inviteToken ? (
            <section className="space-y-4">
              <h1 className="header">Invalid invite link</h1>
              <p className="text-dark-700">
                This activation link is missing its invite token. Ask your doctor to send a new
                one.
              </p>
              <Link to="/portal" className="text-green-500 text-14-regular">
                Go to patient login
              </Link>
            </section>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
              <section className="mb-12 space-y-4">
                <h1 className="header">Set up your portal account</h1>
                <p className="text-dark-700">
                  Choose a password to access your consultation transcripts.
                </p>
              </section>

              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="password"
                label="Password"
                type="password"
                placeholder="At least 8 characters"
              />

              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="confirmPassword"
                label="Confirm password"
                type="password"
                placeholder="Repeat your password"
              />

              {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

              <SubmitButton isLoading={isLoading}>Activate account</SubmitButton>
            </form>
          )}

          <div className="text-14-regular mt-20 flex justify-between">
            <p className="text-dark-600">© 2026 CarePulse</p>
            <Link to="/portal" className="text-green-500">
              Already activated? Log in
            </Link>
          </div>
        </div>
      </section>

      <img src="/assets/images/onboarding-img.png" alt="patient" className="side-img max-w-[50%]" />
    </div>
  );
};

export default PortalActivate;
