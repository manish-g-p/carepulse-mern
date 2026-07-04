import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { RadioGroup, RadioGroupItem } from "../ui/RadioGroup";
import {
  Doctors,
  GenderOptions,
  IdentificationTypes,
  PatientFormDefaultValues,
} from "../../constants";
import { registerPatient } from "../../lib/api";
import { PatientFormValidation } from "../../lib/validation";

import "react-datepicker/dist/react-datepicker.css";
import "react-phone-number-input/style.css";
import CustomFormField, { FormFieldType, SelectItem } from "../CustomFormField";
import { FileUploader } from "../FileUploader";
import SubmitButton from "../SubmitButton";

const RegisterForm = ({ user, userId }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm({
    resolver: zodResolver(PatientFormValidation),
    defaultValues: {
      ...PatientFormDefaultValues,
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const onSubmit = async (values) => {
    setIsLoading(true);
    setServerError("");

    try {
      const formData = new FormData();
      formData.append("userId", userId);
      Object.entries(values).forEach(([key, value]) => {
        if (key === "identificationDocument") return;
        if (value instanceof Date) {
          formData.append(key, value.toISOString());
        } else if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      if (values.identificationDocument && values.identificationDocument.length > 0) {
        formData.append("identificationDocument", values.identificationDocument[0]);
      }

      const newPatient = await registerPatient(formData);

      if (newPatient) {
        navigate(`/patients/${userId}/new-appointment`);
      }
    } catch (error) {
      console.error(error);
      setServerError(error.response?.data?.message || "Something went wrong. Please try again.");
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-12">
      <section className="space-y-4">
        <h1 className="header">Welcome 👋</h1>
        <p className="text-dark-700">Let us know more about yourself.</p>
      </section>

      <section className="space-y-6">
        <div className="mb-9 space-y-1">
          <h2 className="sub-header">Personal Information</h2>
        </div>

        <CustomFormField
          fieldType={FormFieldType.INPUT}
          control={form.control}
          name="name"
          label="Full name"
          placeholder="John Doe"
          iconSrc="/assets/icons/user.svg"
          iconAlt="user"
        />

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="email"
            label="Email address"
            placeholder="johndoe@gmail.com"
            iconSrc="/assets/icons/email.svg"
            iconAlt="email"
          />
          <CustomFormField
            fieldType={FormFieldType.PHONE_INPUT}
            control={form.control}
            name="phone"
            label="Phone Number"
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.DATE_PICKER}
            control={form.control}
            name="birthDate"
            label="Date of birth"
          />
          <CustomFormField
            fieldType={FormFieldType.SKELETON}
            control={form.control}
            name="gender"
            label="Gender"
            renderSkeleton={(field) => (
              <RadioGroup className="flex h-11 gap-6 xl:justify-between">
                {GenderOptions.map((option, i) => (
                  <div key={option + i} className="radio-group">
                    <RadioGroupItem
                      value={option}
                      id={option}
                      name="gender"
                      checked={field.value === option}
                      onChange={() => field.onChange(option)}
                    />
                    <label htmlFor={option} className="cursor-pointer">
                      {option}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            )}
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="address"
            label="Address"
            placeholder="14 street, New york, NY - 5101"
          />
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="occupation"
            label="Occupation"
            placeholder="Software Engineer"
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="emergencyContactName"
            label="Emergency contact name"
            placeholder="Guardian's name"
          />
          <CustomFormField
            fieldType={FormFieldType.PHONE_INPUT}
            control={form.control}
            name="emergencyContactNumber"
            label="Emergency contact number"
            placeholder="(555) 123-4567"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="mb-9 space-y-1">
          <h2 className="sub-header">Medical Information</h2>
        </div>

        <CustomFormField
          fieldType={FormFieldType.SELECT}
          control={form.control}
          name="primaryPhysician"
          label="Primary care physician"
          placeholder="Select a physician"
        >
          {Doctors.map((doctor, i) => (
            <SelectItem key={doctor.name + i} value={doctor.name}>
              <div className="flex cursor-pointer items-center gap-2">
                <img src={doctor.image} width={32} height={32} alt="doctor" className="rounded-full border border-dark-500" />
                <p>{doctor.name}</p>
              </div>
            </SelectItem>
          ))}
        </CustomFormField>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="insuranceProvider"
            label="Insurance provider"
            placeholder="BlueCross BlueShield"
          />
          <CustomFormField
            fieldType={FormFieldType.INPUT}
            control={form.control}
            name="insurancePolicyNumber"
            label="Insurance policy number"
            placeholder="ABC123456789"
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="allergies"
            label="Allergies (if any)"
            placeholder="Peanuts, Penicillin, Pollen"
          />
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="currentMedication"
            label="Current medications"
            placeholder="Ibuprofen 200mg, Levothyroxine 50mcg"
          />
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="familyMedicalHistory"
            label="Family medical history (if relevant)"
            placeholder="Mother had brain cancer, Father has hypertension"
          />
          <CustomFormField
            fieldType={FormFieldType.TEXTAREA}
            control={form.control}
            name="pastMedicalHistory"
            label="Past medical history"
            placeholder="Appendectomy in 2015, Asthma diagnosis in childhood"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="mb-9 space-y-1">
          <h2 className="sub-header">Identification and Verification</h2>
        </div>

        <CustomFormField
          fieldType={FormFieldType.SELECT}
          control={form.control}
          name="identificationType"
          label="Identification Type"
          placeholder="Select identification type"
        >
          {IdentificationTypes.map((type, i) => (
            <SelectItem key={type + i} value={type}>
              {type}
            </SelectItem>
          ))}
        </CustomFormField>

        <CustomFormField
          fieldType={FormFieldType.INPUT}
          control={form.control}
          name="identificationNumber"
          label="Identification Number"
          placeholder="123456789"
        />

        <CustomFormField
          fieldType={FormFieldType.SKELETON}
          control={form.control}
          name="identificationDocument"
          label="Scanned Copy of Identification Document"
          renderSkeleton={(field) => (
            <FileUploader files={field.value} onChange={field.onChange} />
          )}
        />
      </section>

      <section className="space-y-6">
        <div className="mb-9 space-y-1">
          <h2 className="sub-header">Consent and Privacy</h2>
        </div>

        <CustomFormField
          fieldType={FormFieldType.CHECKBOX}
          control={form.control}
          name="treatmentConsent"
          label="I consent to receive treatment for my health condition."
        />
        <CustomFormField
          fieldType={FormFieldType.CHECKBOX}
          control={form.control}
          name="disclosureConsent"
          label="I consent to the use and disclosure of my health information for treatment purposes."
        />
        <CustomFormField
          fieldType={FormFieldType.CHECKBOX}
          control={form.control}
          name="privacyConsent"
          label="I acknowledge that I have reviewed and agree to the privacy policy"
        />
      </section>

      {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

      <SubmitButton isLoading={isLoading}>Submit and Continue</SubmitButton>
    </form>
  );
};

export default RegisterForm;
