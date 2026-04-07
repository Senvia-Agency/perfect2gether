import { motion } from "framer-motion";
import { CheckCircle, MessageCircle } from "lucide-react";

interface SuccessScreenProps {
  userName?: string;
  title: string;
  description: string;
}

export const SuccessScreen = ({ userName, title, description }: SuccessScreenProps) => {
  // Replace {name} placeholder with actual name
  const formattedTitle = title.replace(/{name}/gi, userName || "");
  const formattedDescription = description.replace(/{name}/gi, userName || "");

  return (
    <div className="text-center space-y-6 py-4">
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 200,
          damping: 15
        }}
        className="relative mx-auto w-20 h-20"
      >
        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
        <div className="relative flex items-center justify-center w-full h-full bg-green-500/10 rounded-full">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
      </motion.div>

      {/* WhatsApp Icon */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center"
      >
        <div className="bg-[#25D366]/10 p-3 rounded-full">
          <MessageCircle className="h-6 w-6 text-[#25D366]" />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl font-semibold text-foreground"
      >
        {formattedTitle}
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground"
      >
        {formattedDescription}
      </motion.p>

    </div>
  );
};
