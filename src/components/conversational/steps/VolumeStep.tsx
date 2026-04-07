import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Zap } from "lucide-react";
import { OptionCard } from "../OptionCard";

interface VolumeStepProps {
  onNext: (volume: string) => void;
}

const volumeOptions = [
  { id: "low", label: "Menos de 5", icon: <TrendingDown className="h-8 w-8" /> },
  { id: "medium", label: "Entre 5 a 20", icon: <TrendingUp className="h-8 w-8" /> },
  { id: "high", label: "Mais de 20", icon: <Zap className="h-8 w-8" /> },
];

export const VolumeStep = ({ onNext }: VolumeStepProps) => {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <motion.h1 
          className="text-2xl md:text-3xl font-semibold text-foreground leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Entendido.
        </motion.h1>
        <motion.p 
          className="text-lg text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Quantos leads/contactos recebe por dia, em média?
        </motion.p>
      </div>

      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {volumeOptions.map((option, index) => (
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
