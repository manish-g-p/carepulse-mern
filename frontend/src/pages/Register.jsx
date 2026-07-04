import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RegisterForm from "../components/forms/RegisterForm";
import { getPatient, getUser } from "../lib/api";

const Register = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [userData, patient] = await Promise.all([getUser(userId), getPatient(userId)]);
        if (!active) return;

        if (patient) {
          navigate(`/patients/${userId}/new-appointment`, { replace: true });
          return;
        }
        setUser(userData);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, navigate]);

  if (loading) return null;

  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container">
        <div className="sub-container max-w-[860px] flex-1 flex-col py-10">
          <img src="/assets/icons/logo-full.svg" alt="patient" className="mb-12 h-10 w-fit" />

          <RegisterForm user={user} userId={userId} />

          <p className="copyright py-12">© 2026 CarePulse</p>
        </div>
      </section>

      <img src="/assets/images/register-img.png" alt="patient" className="side-img max-w-[390px]" />
    </div>
  );
};

export default Register;
