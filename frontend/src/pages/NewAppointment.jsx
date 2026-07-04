import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppointmentForm } from "../components/forms/AppointmentForm";
import { getPatient } from "../lib/api";

const NewAppointment = () => {
  const { userId } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPatient(userId);
        setPatient(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[860px] flex-1 justify-between">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="mb-12 h-10 w-fit" />

          <AppointmentForm patientId={patient?._id} userId={userId} type="create" />

          <p className="copyright mt-10 py-12">© 2026 CarePulse</p>
        </div>
      </section>

      <img
        src="/assets/images/appointment-img.png"
        alt="appointment"
        className="side-img max-w-[390px] bg-bottom"
      />
    </div>
  );
};

export default NewAppointment;
