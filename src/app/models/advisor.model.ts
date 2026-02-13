
// advisor.model.ts
export interface Advisor {
  advisorId: string;
  name: string;
  gender: 'male' | 'female' | 'unisex';
  icon: string;
  color: string;
  description: string;
  keyQuestions: string[];
  systemPrompt: string;
  tools: string[];
  triggerKeywords: string[];
  principles: string[];
  ageGroups: string[];
}
