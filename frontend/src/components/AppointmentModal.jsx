import { useState } from "react";
import Button from "./ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/Dialog";
import { AppointmentForm } from "./forms/AppointmentForm";

export const AppointmentModal = ({ patientId, userId, appointment, type }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        className={`capitalize ${type === "schedule" ? "text-green-500" : "text-red-500"}`}
        onClick={() => setOpen(true)}
      >
        {type}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{type} Appointment</DialogTitle>
            <DialogDescription>
              Please fill in the following details to {type} appointment
            </DialogDescription>
          </DialogHeader>

          <AppointmentForm
            userId={userId}
            patientId={patientId}
            type={type}
            appointment={appointment}
            setOpen={setOpen}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AppointmentModal;
