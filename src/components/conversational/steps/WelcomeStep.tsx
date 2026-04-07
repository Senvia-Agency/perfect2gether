import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WelcomeStepProps {
  onNext: (name: string) => void;
  title: string;
  subtitle: string;
  nameLabel?: string;
  namePlaceholder?: string;
  showNameField?: boolean;
}

export const WelcomeStep = ({ 
  onNext, 
  title, 
  subtitle,
  nameLabel = "Como te chamas?",
  namePlaceholder = "O teu nome",
  showNameField = true
}: WelcomeStepProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showNameField && name.trim()) {
      onNext(name.trim());
    } else if (!showNameField) {
      onNext("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-semibold text-foreground text-center"
      >
        {title}
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center"
      >
        {subtitle}
      </motion.p>

      {/* Name Input - only if showNameField is true */}
      {showNameField && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <label className="text-sm text-muted-foreground text-center block">
              {nameLabel}
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              className="text-base h-12 text-center"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: name.trim() ? 1 : 0.5 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              type="submit"
              disabled={!name.trim()}
              className="w-full gap-2"
              size="lg"
            >
              Começar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </>
      )}

      {/* If no name field, just show continue button */}
      {!showNameField && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            type="submit"
            className="w-full gap-2"
            size="lg"
          >
            Começar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </form>
  );
};
