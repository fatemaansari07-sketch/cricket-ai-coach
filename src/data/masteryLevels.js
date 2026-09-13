// Tier 4 "Special AI Coaching" — batting mastery roadmap. User cannot
// unlock a level's shot types until the previous level is passed.
export const MASTERY_LEVELS = [
  { id: 1, name: "Defense", title: "Level 1 · Defense", shotTypes: ["Forward Defense"], passScore: 70,
    description: "Master the basics before anything else — a solid Forward Defense." },
  { id: 2, name: "Drives", title: "Level 2 · Drives", shotTypes: ["Cover Drive", "Straight Drive"], passScore: 72,
    description: "Cover Drive & Straight Drive — attacking down the ground." },
  { id: 3, name: "Cuts & Pulls", title: "Level 3 · Cuts & Pulls", shotTypes: ["Cut Shot", "Pull Shot", "Sweep Shot"], passScore: 75,
    description: "Cut, Pull and Sweep — playing the short ball with control." },
  { id: 4, name: "Match Mastery", title: "Level 4 · Match Mastery", shotTypes: [], passScore: 80,
    description: "All shots unlocked — full match-ready assessment." },
];
