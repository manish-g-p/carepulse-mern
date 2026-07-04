import { Link } from "react-router-dom";
import { PatientForm } from "../components/forms/PatientForm";

const Home = () => {
  return (
    <div className="flex h-screen max-h-screen">
      <section className="remove-scrollbar container my-auto">
        <div className="sub-container max-w-[496px]">
          <img src="/assets/icons/logo-full.svg" alt="logo" className="mb-12 h-10 w-fit" />

          <PatientForm />

          <div className="text-14-regular mt-20 flex justify-between">
            <p className="justify-items-end text-dark-600 xl:text-left">© 2026 CarePulse</p>
            <Link to="/admin" className="text-green-500">
              Admin
            </Link>
          </div>
        </div>
      </section>

      <img
        src="/assets/images/onboarding-img.png"
        alt="patient"
        className="side-img max-w-[50%]"
      />
    </div>
  );
};

export default Home;
