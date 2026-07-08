import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import CustomFormField, { FormFieldType } from "../components/CustomFormField";
import SubmitButton from "../components/SubmitButton";
import { doctorRegister } from "../lib/api";
import { DoctorRegisterValidation } from "../lib/validation";

const DoctorRegister = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(DoctorRegisterValidation),
    defaultValues: { name: "", email: "", specialization: "", password: "" },
  });

  const onSubmit = async (values) => {
    setIsLoading(true);
    setServerError("");

    try {
      const { token, doctor } = await doctorRegister(values);
      localStorage.setItem("doctorToken", token);
      localStorage.setItem("doctorInfo", JSON.stringify(doctor));
      navigate("/doctor/dashboard");
    } catch (error) {
      setServerError(error.response?.data?.message || "Something went wrong. Please try again.");
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
              <h1 className="header">Doctor sign up</h1>
              <p className="text-dark-700">Create an account to record and manage patient conversations.</p>
            </section>

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="name"
              label="Full name"
              placeholder="Dr. Jane Smith"
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="email"
              label="Email"
              placeholder="jane@hospital.com"
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="specialization"
              label="Specialization (optional)"
              placeholder="Cardiology"
            />

            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="password"
              label="Password"
              type="password"
              placeholder="At least 8 characters"
            />

            {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

            <SubmitButton isLoading={isLoading}>Create account</SubmitButton>
          </form>

          <div className="text-14-regular mt-20 flex justify-between">
            <p className="text-dark-600">© 2026 CarePulse</p>
            <Link to="/doctor/login" className="text-green-500">
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </section>

      <img src="/assets/images/onboarding-img.png" alt="doctor" className="side-img max-w-[50%]" />
    </div>
  );
};

export default DoctorRegister;
