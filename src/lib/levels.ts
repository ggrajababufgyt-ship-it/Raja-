export interface LevelDefinition {
  level: number;
  title: string;
  subtitle: string;
  cefr: string;
  description: string;
  topics: string[];
  accentColor: string;
}

export const LEVELS: LevelDefinition[] = [
  {
    level: 1,
    title: 'Beginner',
    subtitle: 'Foundations & Self-Introduction',
    cefr: 'A1',
    description: 'Simple present tense, everyday personal details, hobbies, food, and basic preferences.',
    topics: ['Personal Info', 'Daily Favorites', 'Family & Home', 'Weather & Seasons', 'Simple Hobbies'],
    accentColor: '#2563EB',
  },
  {
    level: 2,
    title: 'Basic English',
    subtitle: 'Routines & Familiar Memories',
    cefr: 'A1+',
    description: 'Describing routines, past memories, hometown, friends, and weekend activities clearly.',
    topics: ['Daily Routine', 'Weekends', 'Childhood Memories', 'Hometown', 'Best Friends'],
    accentColor: '#3B82F6',
  },
  {
    level: 3,
    title: 'Everyday Conversation',
    subtitle: 'Lifestyle & Social Talk',
    cefr: 'A2',
    description: 'Expressing likes, plans, skills, entertainment choices, and everyday social habits.',
    topics: ['Holidays & Travel', 'Movies & Books', 'Learning Skills', 'Making Friends', 'Daily Motivation'],
    accentColor: '#4F46E5',
  },
  {
    level: 4,
    title: 'Daily Communication',
    subtitle: 'Practical Situations & Problem Solving',
    cefr: 'A2+',
    description: 'Handling workplace introductions, missed appointments, time management, and life stories.',
    topics: ['Workplace Intro', 'Handling Delays', 'Time Management', 'Memorable Stories', 'Healthy Lifestyle'],
    accentColor: '#6366F1',
  },
  {
    level: 5,
    title: 'Intermediate English',
    subtitle: 'Opinions, Causes & Hypotheticals',
    cefr: 'B1',
    description: 'Sharing reasoned opinions on society, technology, youth challenges, and life lessons.',
    topics: ['Happiness & Wealth', 'Youth Challenges', 'Tech & Communication', 'Life Without Limits', 'Lessons from Mistakes'],
    accentColor: '#7C3AED',
  },
  {
    level: 6,
    title: 'Advanced English',
    subtitle: 'Critical Thinking & Leadership',
    cefr: 'B2',
    description: 'Discussing leadership qualities, constructive disagreement, failure, and social reform.',
    topics: ['Failure vs Success', 'Respectful Debate', 'Leadership Traits', 'Work-Life Balance', 'Social Solutions'],
    accentColor: '#8B5CF6',
  },
  {
    level: 7,
    title: 'Fluent Communication',
    subtitle: 'Nuance, Persuasion & Decisions',
    cefr: 'B2+',
    description: 'Debating modern connectivity, persuasion tactics, self-discipline, and tough choices.',
    topics: ['Digital Isolation', 'Persuasive Argument', 'Discipline vs Motivation', 'Hard Decisions', 'Security vs Freedom'],
    accentColor: '#1D4ED8',
  },
  {
    level: 8,
    title: 'Professional English',
    subtitle: 'Executive & Career Mastery',
    cefr: 'C1',
    description: 'Managing stakeholder disagreements, team morale, technical translation, and salary negotiation.',
    topics: ['Manager Conflict', 'Team Motivation', 'Explaining Complexity', 'Salary Negotiation', 'Crisis PR'],
    accentColor: '#4338CA',
  },
  {
    level: 9,
    title: 'Expert English',
    subtitle: 'Policy, Ethics & Analytical Rhetoric',
    cefr: 'C1+',
    description: 'Evaluating AI regulation, economic trade-offs, logical defense, and ethical dilemmas.',
    topics: ['AI Governance', 'Growth vs Ecology', 'Logical Defense', 'Ethics vs Ambition', 'Convenience Culture'],
    accentColor: '#6D28D9',
  },
  {
    level: 10,
    title: 'Master English',
    subtitle: 'Philosophical & Global Discourse',
    cefr: 'C2',
    description: 'Articulating complex theses on accountability, freedom, meritocracy, and steel-manning opposing views.',
    topics: ['Tech & Accountability', 'Freedom vs Collective', 'Equality & Ambition', 'Future Education', 'Counter-Argument Mastery'],
    accentColor: '#1E1B4B',
  },
];

export function getLevelDefinition(level: number): LevelDefinition {
  return LEVELS.find((l) => l.level === level) || LEVELS[0];
}
