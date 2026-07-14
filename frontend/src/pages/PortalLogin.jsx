import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import CustomFormField, { FormFieldType } from "../components/CustomFormField";
import SubmitButton from "../components/SubmitButton";
import { patientLogin } from "../lib/api";
import { PortalLoginValidation } from "../lib/validation";

// Stores the patient session and clears any other role's tokens -- a browser
// session is only ever one role at a time (the API client attaches whichever
// token exists).
export const storePatientSession = (token, patient) => {
  localStorage.removeItem("doctorToken");
  localStorage.removeItem("doctorInfo");
  localStorage.removeItem("adminToken");
  localStorage.setItem("patientToken", token);
  localStorage.setItem("patientInfo", JSON.stringify(patient));
};

const PortalLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(PortalLoginValidation),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setIsLoading(true);
    setServerError("");

    try {
      const { token, patient } = await patientLogin(email, password);
      storePatientSession(token, patient);
      navigate("/portal/dashboard");
    } catch (error) {
      setServerError(error.response?.data?.message || "Invalid email or password.");
    }

    setIsLoading(false);
  };

  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[496px]">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="mb-12 h-10 w-fit" />

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
            <section className="mb-12 space-y-4">
              <h1 className="header">Patient portal</h1>
              <p className="text-dark-700">
                Log in to view your consultation transcripts. No account yet? Ask your doctor for
                an invite link.
              </p>
            </section>

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="email"
              label="Email"
              placeholder="you@example.com"
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="password"
              label="Password"
              type="password"
              placeholder="Your password"
            />

            {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

            <SubmitButton isLoading={isLoading}>Log in</SubmitButton>
          </form>

          <div className="text-14-regular mt-20 flex justify-between">
            <p className="text-dark-600">© 2026 CarePulse</p>
            <Link to="/" className="text-green-500">
              ← Home
            </Link>
          </div>
        </div>
      </section>

      <img src="/assets/images/onboarding-img.png" alt="patient" className="side-img max-w-[50%]" />
    </div>
  );
};

export default PortalLogin;
