import { motion } from "framer-motion";
import { ReactNode } from "react";

interface OptionCardProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export const OptionCard = ({ icon, label, onClick, selected, disabled }: OptionCardProps) => {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-3 p-4 rounded-xl
        border-2 transition-colors w-full h-[80px] min-w-[100px]
        ${disabled 
          ? "opacity-50 cursor-not-allowed" 
          : "cursor-pointer"
        }
        ${selected 
          ? "border-primary bg-primary/10" 
          : disabled 
            ? "border-border bg-card"
            : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
        }
      `}
    >
      {icon && (
        <div className={`${selected ? "text-primary" : "text-muted-foreground"}`}>
          {icon}
        </div>
      )}
      <span className={`font-medium text-sm text-center leading-tight ${selected ? "text-primary" : "text-foreground"}`}>
        {label}
      </span>
    </motion.button>
  );
};
