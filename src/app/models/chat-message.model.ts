export type AdvisorId =
  | 'strategy'
  | 'budget'
  | 'mortgage'
  | 'investments'
  | 'pension'
  | 'risk'
  | 'behavior'
  | 'selfemployed'
  | 'special'
  | 'data'
  | 'career'
  | 'meaning'
  | 'abundance'
  | 'young'
  | 'altinvest'
  | 'intergen'
  | 'altretire'
  | 'futureself';

export interface ChatMessage {
  _id?: string;  // Add MongoDB ID as optional property
  text: string;
  sender: 'user' | 'system';
  advisorId?: AdvisorId;
  nextAdvisor?: {
    advisorId: AdvisorId;
  };
  timestamp?: Date;
}