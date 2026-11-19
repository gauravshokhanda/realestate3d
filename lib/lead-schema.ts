import { z } from "zod";
import { slugSchema } from "@/lib/property-validation";

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(100, "Use 100 characters or fewer."),
  email: z.string().trim().email("Please enter a valid email address.").max(254),
  phone: z.string().trim().max(30).refine((value) => value === "" || /^[+()\d\s.-]{7,30}$/.test(value), "Please enter a valid phone number."),
  propertySlug: slugSchema,
  unit: z.string().trim().min(1, "Please choose a residence.").max(100),
  message: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
  website: z.string().max(200).optional().default(""),
});

export type Lead = z.infer<typeof leadSchema>;
export type LeadErrors = Partial<Record<keyof Lead, string>>;

export function fieldErrors(error: z.ZodError): LeadErrors {
  const errors: LeadErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in leadSchema.shape && !errors[field as keyof Lead]) {
      errors[field as keyof Lead] = issue.message;
    }
  }
  return errors;
}
