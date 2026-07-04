import { clsx } from "clsx";

export const cn = (...inputs) => clsx(inputs);

export const convertFileToUrl = (file) => URL.createObjectURL(file);

export const formatDateTime = (dateString) => {
  const dateTimeOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  };
  const dateOptions = {
    weekday: "short",
    month: "short",
    year: "numeric",
    day: "numeric",
  };
  const timeOptions = { hour: "numeric", minute: "numeric", hour12: true };

  const date = new Date(dateString);

  return {
    dateTime: date.toLocaleString("en-US", dateTimeOptions),
    dateOnly: date.toLocaleString("en-US", dateOptions),
    timeOnly: date.toLocaleString("en-US", timeOptions),
  };
};
