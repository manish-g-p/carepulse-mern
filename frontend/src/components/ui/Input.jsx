import { cn } from "../../lib/utils";

const Input = ({ className, ...props }, ref) => (
  <input
    className={cn(
      "flex h-11 w-full rounded-md bg-transparent px-3 py-2 text-14-regular text-white placeholder:text-dark-600 focus:outline-none",
      className
    )}
    {...props}
  />
);

export default Input;
