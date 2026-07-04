import { useState } from "react";
import { Doctors } from "../../constants";
import { formatDateTime } from "../../lib/utils";
import { AppointmentModal } from "../AppointmentModal";
import { StatusBadge } from "../StatusBadge";
import Button from "../ui/Button";

const PAGE_SIZE = 10;

export const AppointmentsTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const rows = data.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="data-table w-full">
      <table className="w-full">
        <thead>
          <tr className="shad-table-row-header">
            <th className="p-4 text-left text-14-medium">#</th>
            <th className="p-4 text-left text-14-medium">Patient</th>
            <th className="p-4 text-left text-14-medium">Status</th>
            <th className="p-4 text-left text-14-medium">Appointment</th>
            <th className="p-4 text-left text-14-medium">Doctor</th>
            <th className="p-4 text-left text-14-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-14-regular text-dark-600">
                No appointments yet.
              </td>
            </tr>
          )}
          {rows.map((appointment, index) => {
            const doctor = Doctors.find((d) => d.name === appointment.primaryPhysician);
            return (
              <tr key={appointment._id} className="shad-table-row">
                <td className="p-4 text-14-medium">{page * PAGE_SIZE + index + 1}</td>
                <td className="p-4 text-14-medium">{appointment.patient?.name}</td>
                <td className="min-w-[115px] p-4">
                  <StatusBadge status={appointment.status} />
                </td>
                <td className="min-w-[100px] p-4 text-14-regular">
                  {formatDateTime(appointment.schedule).dateTime}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {doctor?.image && (
                      <img src={doctor.image} alt="doctor" className="size-8" />
                    )}
                    <p className="whitespace-nowrap">Dr. {doctor?.name || appointment.primaryPhysician}</p>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex gap-1">
                    <AppointmentModal
                      patientId={appointment.patient?._id}
                      userId={appointment.userId}
                      appointment={appointment}
                      type="schedule"
                    />
                    <AppointmentModal
                      patientId={appointment.patient?._id}
                      userId={appointment.userId}
                      appointment={appointment}
                      type="cancel"
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="table-actions">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <p className="text-14-regular text-dark-600">
          Page {page + 1} of {pageCount}
        </p>
        <Button variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default AppointmentsTable;
