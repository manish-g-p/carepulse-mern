import { cn } from "../../lib/utils";

const variantClasses = {
  default: "bg-dark-400 text-white",
  ghost: "bg-transparent hover:bg-dark-400",
  outline: "border border-dark-500 bg-transparent",
};

const Button = ({ className, variant = "default", type = "button", children, ...props }) => {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-14-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
