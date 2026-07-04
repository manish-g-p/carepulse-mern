import { cn } from "../../lib/utils";

export const RadioGroup = ({ className, children }) => (
  <div className={cn("flex h-11 gap-6 xl:justify-between", className)}>{children}</div>
);

export const RadioGroupItem = ({ value, id, checked, onChange, name = "radio-group" }) => (
  <input
    type="radio"
    id={id}
    name={name}
    value={value}
    checked={checked}
    onChange={onChange}
    className="size-4 accent-green-500"
  />
);

export default RadioGroup;
