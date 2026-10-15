import { z } from 'zod';

export const proposalRejectionSchema = z.object({
  reason: z.string().trim().min(1, 'Indique o motivo da recusa.'),
  start: z.string().min(1, 'Indique o início da reunião.'),
  end: z.string().min(1, 'Indique o fim da reunião.'),
  meetingLink: z.union([z.literal(''), z.string().trim().url('Indique um link válido.')]),
}).superRefine((value, context) => {
  const start = new Date(value.start).getTime();
  const end = new Date(value.end).getTime();
  if (!Number.isFinite(start) || start <= Date.now()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['start'], message: 'A reunião tem de começar numa data futura.' });
  }
  if (!Number.isFinite(end) || end <= start) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'O fim da reunião deve ser depois do início.' });
  }
});
export type ProposalRejectionInput = z.infer<typeof proposalRejectionSchema>;
