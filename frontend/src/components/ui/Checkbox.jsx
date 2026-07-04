const Checkbox = ({ id, checked, onCheckedChange }) => (
  <input
    id={id}
    type="checkbox"
    checked={!!checked}
    onChange={(e) => onCheckedChange(e.target.checked)}
    className="size-4 rounded border border-dark-500 accent-green-500"
  />
);

export default Checkbox;
