import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PRODUCTION_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Sparkles, CheckCircle2, Loader2 } from "lucide-react";

const leadFormSchema = z.object({
  company_nif: z.string().trim().min(1, "O NIF da empresa é obrigatório"),
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres").max(100, "O nome não pode exceder 100 caracteres"),
  email: z.string().trim().email("Por favor, insira um email válido").max(255, "O email não pode exceder 255 caracteres"),
  phone: z.string().trim().min(9, "Por favor, insira um número de telefone válido").max(20, "Número de telefone inválido"),
  message: z.string().trim().max(1000, "A mensagem não pode exceder 1000 caracteres").optional(),
  gdpr_consent: z.boolean().refine(val => val === true, {
    message: "É necessário aceitar a Política de Privacidade",
  }),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface PublicLeadFormProps {
  organizationName?: string;
  onSubmit: (data: LeadFormValues) => Promise<void>;
}

export function PublicLeadForm({ organizationName = "Senvia OS", onSubmit }: PublicLeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      company_nif: "",
      name: "",
      email: "",
      phone: "",
      message: "",
      gdpr_consent: false,
    },
  });

  const handleSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      setIsSuccess(true);
      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-card animate-scale-in">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-xl font-semibold text-card-foreground">
          Mensagem enviada com sucesso!
        </h3>
        <p className="mt-2 text-muted-foreground">
          Entraremos em contacto consigo brevemente.
        </p>
        <Button 
          variant="outline" 
          className="mt-6"
          onClick={() => setIsSuccess(false)}
        >
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-8 shadow-card">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-senvia">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-card-foreground">
          Contacte-nos
        </h2>
        <p className="mt-2 text-muted-foreground">
          Preencha o formulário e entraremos em contacto
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="company_nif"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIF Empresa *</FormLabel>
                <FormControl>
                  <Input placeholder="123456789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo *</FormLabel>
                <FormControl>
                  <Input placeholder="O seu nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="seu@email.pt" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone *</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="912 345 678"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensagem (opcional)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Como podemos ajudá-lo?"
                    className="min-h-[100px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gdpr_consent"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    Li e aceito a{" "}
                    <a href={`${PRODUCTION_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                      Política de Privacidade
                    </a>{" "}
                    *
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            variant="senvia" 
            size="lg" 
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A enviar...
              </>
            ) : (
              "Enviar mensagem"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Os seus dados estão protegidos em conformidade com o RGPD
          </p>
        </form>
      </Form>
    </div>
  );
}
