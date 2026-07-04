import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import { Doctors } from "../constants";
import { getAppointment } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const Success = () => {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") || "";
  const [appointment, setAppointment] = useState(null);

  useEffect(() => {
    if (!appointmentId) return;
    (async () => {
      try {
        const data = await getAppointment(appointmentId);
        setAppointment(data);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [appointmentId]);

  if (!appointment) return null;

  const doctor = Doctors.find((d) => d.name === appointment.primaryPhysician);

  return (
    <div className="flex h-screen max-h-screen px-[5%]">
      <div className="success-img">
        <Link to="/">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="h-10 w-fit" />
        </Link>

        <section className="flex flex-col items-center">
          <img src="/assets/gifs/success.gif" alt="success" width={280} height={300} />
          <h2 className="header mb-6 max-w-[600px] text-center">
            Your <span className="text-green-500">appointment request</span> has been successfully submitted!
          </h2>
          <p>We'll be in touch shortly to confirm.</p>
        </section>

        <section className="request-details">
          <p>Requested appointment details: </p>
          <div className="flex items-center gap-3">
            {doctor?.image && <img src={doctor.image} alt="doctor" className="size-6" />}
            <p className="whitespace-nowrap">Dr. {doctor?.name || appointment.primaryPhysician}</p>
          </div>
          <div className="flex gap-2">
            <img src="/assets/icons/calendar.svg" alt="calendar" width={24} height={24} />
            <p>{formatDateTime(appointment.schedule).dateTime}</p>
          </div>
        </section>

        <Button variant="outline" className="shad-primary-btn" onClick={() => {}}>
          <Link to={`/patients/${userId}/new-appointment`}>New Appointment</Link>
        </Button>

        <p className="copyright">© 2026 CarePulse</p>
      </div>
    </div>
  );
};

export default Success;
