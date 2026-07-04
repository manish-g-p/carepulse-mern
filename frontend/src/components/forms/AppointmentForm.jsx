import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Doctors } from "../../constants";
import { createAppointment, updateAppointment } from "../../lib/api";
import { getAppointmentSchema } from "../../lib/validation";

import "react-datepicker/dist/react-datepicker.css";

import CustomFormField, { FormFieldType, SelectItem } from "../CustomFormField";
import SubmitButton from "../SubmitButton";

export const AppointmentForm = ({ userId, patientId, type = "create", appointment, setOpen }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const AppointmentFormValidation = getAppointmentSchema(type);

  const form = useForm({
    resolver: zodResolver(AppointmentFormValidation),
    defaultValues: {
      primaryPhysician: appointment ? appointment.primaryPhysician : "",
      schedule: appointment ? new Date(appointment.schedule) : new Date(Date.now()),
      reason: appointment ? appointment.reason : "",
      note: appointment?.note || "",
      cancellationReason: appointment?.cancellationReason || "",
    },
  });

  const onSubmit = async (values) => {
    setIsLoading(true);
    setServerError("");

    try {
      if (type === "create" && patientId) {
        const newAppointment = await createAppointment({
          userId,
          patient: patientId,
          primaryPhysician: values.primaryPhysician,
          schedule: new Date(values.schedule),
          reason: values.reason,
          note: values.note,
        });

        if (newAppointment) {
          form.reset();
          navigate(`/patients/${userId}/new-appointment/success?appointmentId=${newAppointment._id}`);
        }
      } else {
        const updated = await updateAppointment(appointment._id, {
          primaryPhysician: values.primaryPhysician,
          schedule: new Date(values.schedule),
          cancellationReason: values.cancellationReason,
          type,
        });

        if (updated) {
          setOpen && setOpen(false);
          form.reset();
          window.location.reload();
        }
      }
    } catch (error) {
      console.error(error);
      setServerError(error.response?.data?.message || "Something went wrong. Please try again.");
    }
    setIsLoading(false);
  };

  let buttonLabel;
  switch (type) {
    case "cancel":
      buttonLabel = "Cancel Appointment";
      break;
    case "schedule":
      buttonLabel = "Schedule Appointment";
      break;
    default:
      buttonLabel = "Submit Appointment";
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
      {type === "create" && (
        <section className="mb-12 space-y-4">
          <h1 className="header">New Appointment</h1>
          <p className="text-dark-700">Request a new appointment in 10 seconds.</p>
        </section>
      )}

      {type !== "cancel" && (
        <>
          <CustomFormField
            fieldType={FormFieldType.SELECT}
            control={form.control}
            name="primaryPhysician"
            label="Doctor"
            placeholder="Select a doctor"
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

          <CustomFormField
            fieldType={FormFieldType.DATE_PICKER}
            control={form.control}
            name="schedule"
            label="Expected appointment date"
            showTimeSelect
            dateFormat="MM/dd/yyyy  -  h:mm aa"
          />

          <div className={`flex flex-col gap-6 ${type === "create" ? "xl:flex-row" : ""}`}>
            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="reason"
              label="Appointment reason"
              placeholder="Annual monthly check-up"
              disabled={type === "schedule"}
            />

            <CustomFormField
              fieldType={FormFieldType.TEXTAREA}
              control={form.control}
              name="note"
              label="Comments/notes"
              placeholder="Prefer afternoon appointments, if possible"
              disabled={type === "schedule"}
            />
          </div>
        </>
      )}

      {type === "cancel" && (
        <CustomFormField
          fieldType={FormFieldType.TEXTAREA}
          control={form.control}
          name="cancellationReason"
          label="Reason for cancellation"
          placeholder="Urgent meeting came up"
        />
      )}

      {serverError && <p className="shad-error text-14-regular">{serverError}</p>}

      <SubmitButton isLoading={isLoading} className={type === "cancel" ? "shad-danger-btn w-full" : "shad-primary-btn w-full"}>
        {buttonLabel}
      </SubmitButton>
    </form>
  );
};

export default AppointmentForm;
