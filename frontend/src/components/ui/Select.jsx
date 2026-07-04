import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export const SelectItem = ({ children }) => children;

export const Select = ({ value, onValueChange, placeholder, children, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = Array.isArray(children) ? children : [children];
  const selected = items.find((item) => item && item.props.value === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "shad-select-trigger flex h-11 w-full items-center justify-between rounded-md border px-3 text-14-regular",
          className
        )}
      >
        <span className={selected ? "text-white" : "text-dark-600"}>
          {selected ? selected.props.children : placeholder}
        </span>
        <span className="text-dark-600">▾</span>
      </button>

      {open && (
        <div className="shad-select-content absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border p-1 shadow-lg">
          {items.map((item, i) =>
            item ? (
              <div
                key={item.props.value + i}
                onClick={() => {
                  onValueChange(item.props.value);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-md p-2 text-14-regular hover:bg-dark-500"
              >
                {item.props.children}
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
};

export default Select;
