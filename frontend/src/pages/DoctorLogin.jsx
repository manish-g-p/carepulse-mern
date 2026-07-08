import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import CustomFormField, { FormFieldType } from "../components/CustomFormField";
import SubmitButton from "../components/SubmitButton";
import { doctorLogin } from "../lib/api";
import { DoctorLoginValidation } from "../lib/validation";

const DoctorLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(DoctorLoginValidation),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }) => {
    setIsLoading(true);
    setServerError("");

    try {
      const { token, doctor } = await doctorLogin(email, password);
      localStorage.setItem("doctorToken", token);
      localStorage.setItem("doctorInfo", JSON.stringify(doctor));
      navigate("/doctor/dashboard");
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
              <h1 className="header">Doctor login</h1>
              <p className="text-dark-700">Log in to record and review patient conversations.</p>
            </section>

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
            <Link to="/doctor/register" className="text-green-500">
              New here? Create an account
            </Link>
          </div>
        </div>
      </section>

      <img src="/assets/images/onboarding-img.png" alt="doctor" className="side-img max-w-[50%]" />
    </div>
  );
};

export default DoctorLogin;
