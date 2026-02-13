// advisor-ids.js - Single Source of Truth for all advisor IDs and names

const ADVISOR_IDS = {
  STRATEGY: 'strategy',
  BUDGET: 'budget',
  MORTGAGE: 'mortgage',
  INVESTMENTS: 'investments',
  PENSION: 'pension',
  RISK: 'risk',
  BEHAVIOR: 'behavior',
  SELFEMPLOYED: 'selfemployed',
  SPECIAL: 'special',
  DATA: 'data',
  CAREER: 'career',
  MEANING: 'meaning',
  ABUNDANCE: 'abundance',
  YOUNG: 'young',
  ALTINVEST: 'altinvest',
  INTERGEN: 'intergen',
  ALTRETIRE: 'altretire',
  FUTURESELF: 'futureself'
};

// Map of advisor IDs to Hebrew names (for debug/logging)
const ADVISOR_NAMES = {
  strategy: 'אופק',
  budget: 'רון',
  mortgage: 'גיא',
  investments: 'דנה',
  pension: 'יעל',
  risk: 'ענת',
  behavior: 'ליאור',
  selfemployed: 'עידו',
  special: 'אלינור',
  data: 'תום',
  career: 'נועם',
  meaning: 'אמיר',
  abundance: 'הדס',
  young: 'טל',
  altinvest: 'יואב',
  intergen: 'מיכל',
  altretire: 'נועה',
  futureself: 'העצמי העתידי'
};

// Array of all valid advisor IDs for validation
const ALL_ADVISOR_IDS = Object.values(ADVISOR_IDS);

module.exports = {
  ADVISOR_IDS,
  ADVISOR_NAMES,
  ALL_ADVISOR_IDS
};
