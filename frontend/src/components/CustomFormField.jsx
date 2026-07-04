import ReactDatePicker from "react-datepicker";
import PhoneInput from "react-phone-number-input";
import { Controller } from "react-hook-form";

import Checkbox from "./ui/Checkbox";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import { Select, SelectItem } from "./ui/Select";

import "react-datepicker/dist/react-datepicker.css";
import "react-phone-number-input/style.css";

export const FormFieldType = {
  INPUT: "input",
  TEXTAREA: "textarea",
  PHONE_INPUT: "phoneInput",
  CHECKBOX: "checkbox",
  DATE_PICKER: "datePicker",
  SELECT: "select",
  SKELETON: "skeleton",
};

export { SelectItem };

const RenderInput = ({ field, props }) => {
  const { ref: _ref, ...fieldNoRef } = field;

  switch (props.fieldType) {
    case FormFieldType.INPUT:
      return (
        <div className="flex items-center rounded-md border border-dark-500 bg-dark-400">
          {props.iconSrc && (
            <img src={props.iconSrc} height={24} width={24} alt={props.iconAlt || "icon"} className="ml-2" />
          )}
          <Input placeholder={props.placeholder} {...fieldNoRef} className="shad-input border-0" />
        </div>
      );
    case FormFieldType.TEXTAREA:
      return (
        <Textarea
          placeholder={props.placeholder}
          {...fieldNoRef}
          className="shad-textArea"
          disabled={props.disabled}
        />
      );
    case FormFieldType.PHONE_INPUT:
      return (
        <PhoneInput
          defaultCountry="US"
          placeholder={props.placeholder}
          international
          withCountryCallingCode
          value={field.value}
          onChange={field.onChange}
          className="input-phone"
        />
      );
    case FormFieldType.CHECKBOX:
      return (
        <div className="flex items-center gap-4">
          <Checkbox id={props.name} checked={field.value} onCheckedChange={field.onChange} />
          <label htmlFor={props.name} className="checkbox-label">
            {props.label}
          </label>
        </div>
      );
    case FormFieldType.DATE_PICKER:
      return (
        <div className="flex items-center rounded-md border border-dark-500 bg-dark-400">
          <img src="/assets/icons/calendar.svg" height={24} width={24} alt="calendar" className="ml-2" />
          <ReactDatePicker
            showTimeSelect={props.showTimeSelect ?? false}
            selected={field.value}
            onChange={(date) => field.onChange(date)}
            timeInputLabel="Time:"
            dateFormat={props.dateFormat ?? "MM/dd/yyyy"}
            wrapperClassName="date-picker"
          />
        </div>
      );
    case FormFieldType.SELECT:
      return (
        <Select onValueChange={field.onChange} value={field.value} placeholder={props.placeholder}>
          {props.children}
        </Select>
      );
    case FormFieldType.SKELETON:
      return props.renderSkeleton ? props.renderSkeleton(field) : null;
    default:
      return null;
  }
};

const CustomFormField = (props) => {
  const { control, name, label } = props;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex-1 space-y-2">
          {props.fieldType !== FormFieldType.CHECKBOX && label && (
            <p className="shad-input-label">{label}</p>
          )}
          <RenderInput field={field} props={props} />
          {fieldState.error && <p className="shad-error text-14-regular">{fieldState.error.message}</p>}
        </div>
      )}
    />
  );
};

export default CustomFormField;
