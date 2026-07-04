import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { createUser } from "../../lib/api";
import { UserFormValidation } from "../../lib/validation";

import "react-phone-number-input/style.css";
import CustomFormField, { FormFieldType } from "../CustomFormField";
import SubmitButton from "../SubmitButton";

export const PatientForm = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(UserFormValidation),
    defaultValues: { name: "", email: "", phone: "" },
  });

  const onSubmit = async (values) => {
    setIsLoading(true);
    setServerError("");

    try {
      const newUser = await createUser(values);
      if (newUser) {
        navigate(`/patients/${newUser.userId}/register`);
      }
    } catch (error) {
      console.error(error);
      setServerError(error.response?.data?.message || "Something went wrong. Please try again.");
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
      <section className="mb-12 space-y-4">
        <h1 className="header">Hi there 👋</h1>
        <p className="text-dark-700">Get started with appointments.</p>
      </section>

      <CustomFormField
        fieldType={FormFieldType.INPUT}
        control={form.control}
        name="name"
        label="Full name"
        placeholder="John Doe"
        iconSrc="/assets/icons/user.svg"
        iconAlt="user"
      />

      <CustomFormField
        fieldType={FormFieldType.INPUT}
        control={form.control}
        name="email"
        label="Email"
        placeholder="johndoe@gmail.com"
        iconSrc="/assets/icons/email.svg"
        iconAlt="email"
      />

      <CustomFormField
        fieldType={FormFieldType.PHONE_INPUT}
        control={form.control}
        name="phone"
        label="Phone number"
        placeholder="(555) 123-4567"
      />

      {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

      <SubmitButton isLoading={isLoading}>Get Started</SubmitButton>
    </form>
  );
};

export default PatientForm;
