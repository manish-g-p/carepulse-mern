import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/Dialog";
import InputOTP from "./ui/InputOTP";
import Button from "./ui/Button";
import { adminLogin } from "../lib/api";

export const AdminLoginModal = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const closeModal = () => {
    setOpen(false);
    navigate("/");
  };

  const validatePasskey = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { token } = await adminLogin(passkey);
      // One role per browser session: a lingering doctor/patient token would
      // win in the API client's token precedence and 403 every admin call.
      localStorage.removeItem("doctorToken");
      localStorage.removeItem("doctorInfo");
      localStorage.removeItem("patientToken");
      localStorage.removeItem("patientInfo");
      localStorage.setItem("adminToken", token);
      setOpen(false);
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || "Invalid passkey. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between">
            Admin Access Verification
            <img
              src="/assets/icons/close.svg"
              alt="close"
              width={20}
              height={20}
              onClick={closeModal}
              className="cursor-pointer"
            />
          </DialogTitle>
          <DialogDescription>To access the admin page, please enter the passkey.</DialogDescription>
        </DialogHeader>

        <div>
          <InputOTP maxLength={6} value={passkey} onChange={setPasskey} />
          {error && <p className="shad-error text-14-regular mt-4 flex justify-center">{error}</p>}
        </div>

        <DialogFooter>
          <Button onClick={validatePasskey} disabled={isLoading} className="shad-primary-btn w-full">
            {isLoading ? "Verifying..." : "Enter Admin Passkey"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoginModal;
