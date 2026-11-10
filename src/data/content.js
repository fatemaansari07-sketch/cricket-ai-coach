export const FEEDBACK_BANK = {
  batting: {
    correct: [
      "Head steady and still at the point of contact",
      "Full extension through the shot, bat finishing high",
      "Weight transferred smoothly onto the front foot",
      "Bat came down straight from the backlift",
      "Front elbow high, driving through the line of the ball",
    ],
    incorrect: [
      "Head falling across to the off side before contact",
      "Front elbow collapsing early, shot played with hands only",
      "Weight stuck on the back foot through the shot",
      "Bat face closing too early, ball likely to go uppishly",
      "Backlift coming from gully instead of straight back",
    ],
  },
  bowling: {
    correct: [
      "Run-up rhythm is consistent right into the crease",
      "Front arm high and pointing at the target on release",
      "Seam position upright and stable through delivery",
      "Strong braced front leg at the point of release",
      "Follow-through fully completed, no cutting off early",
    ],
    incorrect: [
      "Front arm collapsing down too early before release",
      "Load-up is rushed, losing balance at the crease",
      "Seam wobbling — grip needs to be tightened",
      "Front leg bending on landing, losing bowling height",
      "Follow-through cut short, pulling out of the action",
    ],
  },
  fielding: {
    correct: [
      "Ready position low and balanced before the ball is bowled",
      "Soft hands absorbing the ball cleanly on the pickup",
      "Quick transfer from hand to hand before the throw",
      "Strong low release on the throw, hitting the target end",
      "Reacted early off the bat, good first-step direction",
    ],
    incorrect: [
      "Standing too upright, slow to react to the ball",
      "Hard hands on the pickup, ball popping out",
      "Throw released off the wrong foot, losing accuracy",
      "Chasing the ball at an angle instead of straight lines",
      "Backing up positions not taken on the throw-in",
    ],
  },
};

export const DRILLS = {
  batting: [
    "Shadow batting in front of a mirror — 15 mins",
    "Head-still drill: ball on a string, watch it onto the bat",
    "Front elbow raise drill with a resistance band",
    "Throwdowns — 30 balls, focus on weight transfer",
    "Straight bat hitting off a tee — 20 reps",
  ],
  bowling: [
    "Run-up rhythm drill — mark and repeat run-up 10 times",
    "Wall seam drill — release ball at a target on a wall",
    "Front arm drill with a resistance band, 3 sets of 12",
    "Bowling at a single stump for line — 2 overs",
    "Follow-through completion drill, walk through in slow motion",
  ],
  fielding: [
    "Reaction catches drill with a partner — 15 mins",
    "Low ready-position holds — 5 x 30 seconds",
    "Soft hands pickup drill off a wall — 20 reps",
    "Run-and-throw at a single stump — 15 throws",
    "Backing-up positioning drill in a group net session",
  ],
};

export const PRO_PLAYERS = [
  { id: "vk", name: "Virat Kohli", role: "Batting", style: "Cover Drive" },
  { id: "rs", name: "Rohit Sharma", role: "Batting", style: "Pull Shot" },
  { id: "ba", name: "Babar Azam", role: "Batting", style: "Straight Drive" },
  { id: "jb", name: "Jasprit Bumrah", role: "Bowling", style: "Yorker" },
  { id: "mrp", name: "MR Patel*", role: "Fielding", style: "Diving Stop" },
];

export const SHOP_ADS_SEED = [
  { id: "seed-1", shop_name: "Sunrise Sports", product_name: "SG Sunny Tonny Bat", price_inr: 2499, category: "Bat", phone: "+91 98xxxxxxx0", address: "MG Road, Nagpur" },
  { id: "seed-2", shop_name: "Cover Drive Store", product_name: "Kookaburra Cricket Shoes", price_inr: 3199, category: "Shoes", phone: "+91 98xxxxxxx1", address: "Sector 14, Gurugram" },
  { id: "seed-3", shop_name: "Boundary Line Cricket", product_name: "SS Batting Gloves", price_inr: 899, category: "Gloves", phone: "+91 98xxxxxxx2", address: "FC Road, Pune" },
];

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * MOCK analysis — replace this with a real call to your video/pose-estimation
 * service (e.g. a backend endpoint running MediaPipe/OpenPose) once you have one.
 * The shape returned here ({ category, correct, incorrect, score }) is what the
 * rest of the app expects, so you can swap the internals freely.
 */
export function generateAnalysis(category) {
  const bank = FEEDBACK_BANK[category];
  const correct = shuffle(bank.correct).slice(0, 2 + Math.floor(Math.random() * 2));
  const incorrect = shuffle(bank.incorrect).slice(0, 2 + Math.floor(Math.random() * 2));
  const score = Math.max(55, 95 - incorrect.length * 9 + Math.floor(Math.random() * 6));
  return { category, correct, incorrect, score };
}

export function generatePlanDays(analysis) {
  const cat = analysis.category;
  const drills = DRILLS[cat];
  const focusAreas = analysis.incorrect;
  const days = [];
  for (let d = 1; d <= 30; d++) {
    if (d % 7 === 0) {
      days.push({ day: d, rest: true, focus: "Recovery day — light stretching & video review" });
    } else {
      const drill = drills[(d - 1) % drills.length];
      const focus = focusAreas[(d - 1) % focusAreas.length];
      days.push({ day: d, rest: false, drill, focus });
    }
  }
  return days;
}
