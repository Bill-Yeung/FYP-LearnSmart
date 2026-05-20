import React from "react";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled, className = "" }) => (
  <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
    <span className="text-amber-900 dark:text-amber-100">Off</span>
    <button
      type="button"
      className={`relative inline-flex h-5 w-9 items-center rounded-full border border-amber-300 bg-amber-100 transition-colors ${checked ? "bg-amber-500 border-amber-500" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
      />
    </button>
    <span className="text-amber-900 dark:text-amber-100">On</span>
    {label && <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>}
  </label>
);

export default Switch;
