import { useRef } from "react";

const InputOTP = ({ maxLength = 6, value, onChange }) => {
  const inputsRef = useRef([]);
  const chars = value.split("").concat(Array(maxLength).fill("")).slice(0, maxLength);

  const setCharAt = (index, char) => {
    const next = chars.slice();
    next[index] = char;
    onChange(next.join("").slice(0, maxLength));
  };

  const handleChange = (index, e) => {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    setCharAt(index, char);
    if (char && index < maxLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !chars[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex w-full justify-between gap-2">
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          value={char}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          className="shad-otp-slot bg-dark-400 text-center text-white focus:outline-none focus:border-green-500"
        />
      ))}
    </div>
  );
};

export default InputOTP;
