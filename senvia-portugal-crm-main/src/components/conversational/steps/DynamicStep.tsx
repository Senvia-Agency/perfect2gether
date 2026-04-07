import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { OptionCard } from "@/components/conversational/OptionCard";
import { CustomField } from "@/types";

interface DynamicStepProps {
  field: {
    type: 'name' | 'email' | 'phone' | 'message' | 'custom';
    key: string;
    label: string;
    required: boolean;
    fieldType?: CustomField['type'];
    options?: string[];
    placeholder?: string;
  };
  userName?: string;
  showUserName?: boolean;
  onNext: (value: string) => void;
  isSubmitting?: boolean;
  submitButtonText?: string;
  isLastStep?: boolean;
}

export const DynamicStep = ({ 
  field, 
  userName, 
  showUserName = false,
  onNext, 
  isSubmitting, 
  submitButtonText = "Continuar",
  isLastStep 
}: DynamicStepProps) => {
  const [value, setValue] = useState("");
  const [hasAdvanced, setHasAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAdvanced) return;
    if (value.trim() || !field.required) {
      setHasAdvanced(true);
      onNext(value.trim());
    }
  };

  const handleOptionSelect = (option: string) => {
    if (hasAdvanced) return; // Block if already advanced
    
    setHasAdvanced(true); // Mark immediately to prevent duplicate clicks
    setValue(option);
    setTimeout(() => onNext(option), 300);
  };

  const isValid = !field.required || value.trim().length > 0;
  const isPhoneValid = field.type === 'phone' ? value.length >= 9 : true;
  const canSubmit = isValid && isPhoneValid;

  // For select fields with options, render as cards
  if (field.fieldType === 'select' && field.options && field.options.length > 0) {
    return (
      <div className="space-y-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-medium text-foreground text-center"
        >
          {showUserName && userName ? `Prazer, ${userName}! ` : ""}{field.label}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          {field.options.map((option, index) => (
            <OptionCard
              key={index}
              label={option}
              onClick={() => handleOptionSelect(option)}
              selected={value === option}
              disabled={hasAdvanced}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  // For other field types, render appropriate input
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-lg font-medium text-foreground text-center"
      >
        {showUserName && userName ? `Prazer, ${userName}! ` : ""}{field.label}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {field.type === 'phone' ? (
          <PhoneInput
            value={value}
            onChange={setValue}
            placeholder={field.placeholder || "Número de telemóvel"}
          />
        ) : field.type === 'message' || field.fieldType === 'textarea' ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder || field.label}
            className="text-base min-h-[100px]"
          />
        ) : field.fieldType === 'number' ? (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder || field.label}
            className="text-base h-12 text-center"
          />
        ) : field.fieldType === 'checkbox' ? (
          <div className="flex items-center justify-center gap-3">
            <input
              type="checkbox"
              id={field.key}
              checked={value === 'true'}
              onChange={(e) => setValue(e.target.checked ? 'true' : 'false')}
              className="w-5 h-5"
            />
            <label htmlFor={field.key} className="text-foreground">
              {field.placeholder || 'Sim'}
            </label>
          </div>
        ) : (
          <Input
            type={field.type === 'email' ? 'email' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder || field.label}
            className="text-base h-12 text-center"
          />
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: canSubmit ? 1 : 0.5 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full gap-2"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              A enviar...
            </>
          ) : (
            <>
              {isLastStep ? submitButtonText : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </form>
  );
};
