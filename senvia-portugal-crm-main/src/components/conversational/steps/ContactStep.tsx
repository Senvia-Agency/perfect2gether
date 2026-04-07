import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";

interface ContactStepProps {
  onNext: (phone: string) => void;
  isSubmitting?: boolean;
}

export const ContactStep = ({ onNext, isSubmitting }: ContactStepProps) => {
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && phone.length >= 9) {
      onNext(phone);
    }
  };

  const isValidPhone = phone && phone.replace(/\D/g, "").length >= 9;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <motion.h1 
          className="text-2xl md:text-3xl font-semibold text-foreground leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Já tenho a sua análise preliminar.
        </motion.h1>
        <motion.p 
          className="text-lg text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Onde devo enviar a mensagem de teste agora?
        </motion.p>
      </div>

      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <PhoneInput
          value={phone}
          onChange={setPhone}
          placeholder="Número de WhatsApp..."
          className="h-14"
        />
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isValidPhone ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Button
            type="submit"
            disabled={!isValidPhone || isSubmitting}
            className="w-full h-12 text-base gap-2"
            variant="whatsapp"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A enviar...
              </>
            ) : (
              <>
                Enviar para WhatsApp
                <Send className="h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </form>
  );
};
