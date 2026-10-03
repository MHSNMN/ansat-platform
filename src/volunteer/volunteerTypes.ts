export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "radio"
  | "checkbox"
  | "select"
  | "countries"
  | "file"
  | "consent";

export interface FormQuestion {
  id: string;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  order: number;
}

export type VolunteerFormStatus = "draft" | "published" | "closed";

export interface VolunteerFormDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  targetRole: string; // e.g. "NARRATOR", "AUDIO_ENGINEER", "QA_REVIEWER", "MEMBER"
  status: VolunteerFormStatus;
  openDate?: string;
  closeDate?: string;
  maxCapacity?: number;
  postSubmitMessage: string;
  termsVersion: string;
  questions: FormQuestion[];
  createdAt: string;
  updatedAt: string;
}

export type ApplicationWorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_INFO"
  | "ACCEPTED"
  | "REJECTED"
  | "WAITLISTED";

export interface VolunteerApplication {
  id: string;
  formId: string;
  formName: string;
  targetRole: string;
  applicantName: string;
  applicantUsername?: string;
  applicantEmail: string;
  applicantPhone?: string;
  applicantCountry?: string;
  answers: Record<string, any>;
  status: ApplicationWorkflowStatus;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdUserId?: string;
  termsAccepted: boolean;
  publicProfileConsent: boolean;
  createdAt: string;
  updatedAt: string;
}
