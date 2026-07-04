import { cn } from "../../lib/utils";

const Textarea = ({ className, ...props }) => (
  <textarea
    rows={4}
    className={cn(
      "shad-textArea flex w-full rounded-md border px-3 py-2 text-14-regular text-white focus:outline-none",
      className
    )}
    {...props}
  />
);

export default Textarea;
