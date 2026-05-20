import React from "react";

type NumberFieldProps = {
  label?: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
};

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  error,
  className = "",
}) => (
  <div className={className}>
    {label && (
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
    )}
    <input
      type="number"
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

export default NumberField;
