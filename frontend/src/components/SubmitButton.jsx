import { cn } from "../lib/utils";

const SubmitButton = ({ isLoading, className, children, ...props }) => {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={cn(
        "shad-primary-btn w-full rounded-md py-3 text-14-medium disabled:opacity-70",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <img src="/assets/icons/loader.svg" alt="loader" width={24} height={24} className="animate-spin" />
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default SubmitButton;
