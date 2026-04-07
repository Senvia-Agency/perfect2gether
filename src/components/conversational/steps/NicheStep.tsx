import { motion } from "framer-motion";
import { Stethoscope, HardHat, Home, Package } from "lucide-react";
import { OptionCard } from "../OptionCard";

interface NicheStepProps {
  userName: string;
  onNext: (niche: string) => void;
}

const nicheOptions = [
  { id: "clinica", label: "Clínica / Saúde", icon: <Stethoscope className="h-8 w-8" /> },
  { id: "construcao", label: "Construção / Obras", icon: <HardHat className="h-8 w-8" /> },
  { id: "imobiliaria", label: "Imobiliária", icon: <Home className="h-8 w-8" /> },
  { id: "outro", label: "Outro", icon: <Package className="h-8 w-8" /> },
];

export const NicheStep = ({ userName, onNext }: NicheStepProps) => {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <motion.h1 
          className="text-2xl md:text-3xl font-semibold text-foreground leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Prazer, {userName}!
        </motion.h1>
        <motion.p 
          className="text-lg text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Qual é o seu tipo de negócio?
        </motion.p>
      </div>

      <motion.div 
        className="grid grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {nicheOptions.map((option, index) => (
          <motion.div
            key={option.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
          >
            <OptionCard
              icon={option.icon}
              label={option.label}
              onClick={() => onNext(option.id)}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
