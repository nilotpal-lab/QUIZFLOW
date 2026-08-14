/* ================================================================
   QuizFlow — Community Quiz Library & Practice Store
   Clean Verified Founder Decks with AI auto-categorization,
   real user ratings, reviews, and 1-click live hosting.
   ================================================================ */

import type { AIGeneratedQuiz, Difficulty, BloomLevel } from './types'
import { syncCommunityQuizToSupabase } from './supabaseClient'

export type QuizCategory =
  | 'All'
  | 'Sports'
  | 'Biology'
  | 'Mathematics'
  | 'Technology'
  | 'History'
  | 'Science'
  | 'General Knowledge'

export interface QuizComment {
  id: string
  authorName: string
  authorAvatar?: string
  rating: number // 1 - 5
  text: string
  createdAt: number
}

export interface CommunityQuiz {
  id: string
  title: string
  description: string
  category: QuizCategory
  tags: string[]
  isFounder: boolean
  authorName: string
  difficulty: Difficulty
  bloomLevel: BloomLevel
  questionCount: number
  playsCount: number
  rating: number
  reviewCount: number
  quiz: AIGeneratedQuiz
  comments: QuizComment[]
  createdAt: number
}

const STORAGE_KEY = 'qf_community_quizzes_v3_clean'

export const FOUNDER_QUIZZES: CommunityQuiz[] = [
  {
    id: 'founder_bio_cellular',
    title: 'Cellular Respiration & Bio-Energy',
    description: 'Glycolysis, the Krebs cycle, ATP synthesis, and mitochondrial transport chains.',
    category: 'Biology',
    tags: ['Mitochondria', 'ATP', 'Cell Biology', 'Biochemistry'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'medium',
    bloomLevel: 'Comprehension',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Cellular Respiration & Bio-Energy',
      description: 'Glycolysis, the Krebs cycle, ATP synthesis, and mitochondrial transport chains.',
      language: 'English',
      bloomLevel: 'Comprehension',
      questions: [
        {
          prompt: 'What is the primary cellular powerhouse organelle where the Krebs Cycle and ATP synthesis occur?',
          choices: ['Mitochondria', 'Ribosome', 'Golgi Apparatus', 'Endoplasmic Reticulum'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Mitochondria generate ATP via oxidative phosphorylation and the Krebs cycle.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'Ribosomes synthesize proteins', 'Golgi packages vesicles', 'ER synthesizes lipids/proteins']
        },
        {
          prompt: 'During glycolysis in the cytoplasm, what is one molecule of glucose converted into?',
          choices: ['Two molecules of Pyruvate', 'Two molecules of Lactic Acid', 'One molecule of Acetyl-CoA', 'Carbon Dioxide and Water'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Glycolysis splits one 6-carbon glucose into two 3-carbon pyruvate molecules, yielding a net 2 ATP.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Lactic acid is produced only during anaerobic fermentation', 'Pyruvate converts to Acetyl-CoA in mitochondria', 'CO2 and water are end products of the full cycle']
        },
        {
          prompt: 'Why does solid ice float on liquid water?',
          choices: ['Hydrogen bonds create an open hexagonal crystal lattice of lower density', 'Ice molecules are chemically lighter than water', 'Trapped air bubbles push ice upwards', 'Surface tension repels solid ice'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Water expands as it freezes because stable hydrogen bonds form an open hexagonal lattice, making ice ~9% less dense than liquid water.',
          time_limit_ms: 20000,
          bloom_level: 'Comprehension',
          imageUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'Ice molecules have the exact same chemical weight (H2O)', 'Pure ice floats even with zero air bubbles', 'Surface tension is not the primary cause of buoyancy']
        },
        {
          prompt: 'Which enzyme serves as the rotary molecular turbine that synthesizes ATP from ADP using a proton gradient?',
          choices: ['ATP Synthase', 'DNA Polymerase', 'Rubisco', 'Helicase'],
          correct_index: 0,
          difficulty: 'hard',
          explanation: 'ATP Synthase utilizes the chemiosmotic proton motive force across the inner mitochondrial membrane to forge ATP.',
          time_limit_ms: 25000,
          bloom_level: 'Recall',
          misconceptions: ['', 'DNA Polymerase replicates DNA', 'Rubisco fixes carbon in photosynthesis', 'Helicase unwinds DNA double strands']
        },
        {
          prompt: 'In the electron transport chain, what is the final terminal electron acceptor?',
          choices: ['Oxygen (O2)', 'NAD+', 'Water (H2O)', 'Carbon Dioxide (CO2)'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Oxygen acts as the terminal electron acceptor, bonding with protons to form water.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'NAD+ accepts electrons earlier in glycolysis and Krebs', 'Water is formed as the product, not the acceptor', 'CO2 is a byproduct of decarboxylation']
        }
      ]
    }
  },
  {
    id: 'founder_sports_world_cup',
    title: 'Football & World Cup History',
    description: 'FIFA World Cup tournament records, iconic stadiums, and tournament milestones.',
    category: 'Sports',
    tags: ['Football', 'FIFA World Cup', 'Champions', 'Athletics'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'medium',
    bloomLevel: 'Recall',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Football & World Cup History',
      description: 'FIFA World Cup tournament records, iconic stadiums, and tournament milestones.',
      language: 'English',
      bloomLevel: 'Recall',
      questions: [
        {
          prompt: 'Which country has won the most FIFA Men’s World Cup titles in history (5 titles)?',
          choices: ['Brazil', 'Germany', 'Italy', 'Argentina'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Brazil won the World Cup in 1958, 1962, 1970, 1994, and 2002.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'Germany has won 4 titles', 'Italy has won 4 titles', 'Argentina has won 3 titles (1978, 1986, 2022)']
        },
        {
          prompt: 'Who holds the record for the most goals scored in a single FIFA World Cup tournament (13 goals in 1958)?',
          choices: ['Just Fontaine', 'Pelé', 'Miroslav Klose', 'Ronaldo Nazário'],
          correct_index: 0,
          difficulty: 'hard',
          explanation: 'French striker Just Fontaine scored an incredible 13 goals in 6 games in the 1958 Sweden tournament.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Pelé scored 6 in 1958', 'Klose holds the all-time career record with 16 goals across 4 tournaments', 'Ronaldo scored 8 in 2002']
        },
        {
          prompt: 'In which year was the first ever FIFA World Cup tournament hosted in Uruguay?',
          choices: ['1930', '1924', '1938', '1950'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'The inaugural FIFA World Cup took place in Montevideo, Uruguay in July 1930, won by Uruguay.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', '1924 was the Olympic football tournament', '1938 was held in France', '1950 was the Maracanazo tournament in Brazil']
        },
        {
          prompt: 'Which legendary stadium hosted both the 1970 and 1986 World Cup Finals in Mexico City?',
          choices: ['Estadio Azteca', 'Maracanã', 'Wembley Stadium', 'Camp Nou'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Estadio Azteca hosted the 1970 final (Pelé) and the 1986 final (Maradona).',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Maracanã is in Rio de Janeiro, Brazil', 'Wembley is in London, UK', 'Camp Nou is in Barcelona, Spain']
        },
        {
          prompt: 'Who scored both the "Hand of God" and "Goal of the Century" against England in the 1986 World Cup?',
          choices: ['Diego Maradona', 'Gabriel Batistuta', 'Zico', 'Michel Platini'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Diego Maradona scored both legendary goals during the 1986 quarter-final against England.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Batistuta played in 1994-2002', 'Zico represented Brazil', 'Platini was the captain of France']
        }
      ]
    }
  },
  {
    id: 'founder_math_algebra',
    title: 'Algebra, Equations & Logic Puzzles',
    description: 'Quadratic formulas, linear equations, exponential growth, and algorithmic problem-solving.',
    category: 'Mathematics',
    tags: ['Algebra', 'Equations', 'Calculus', 'Logic'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'hard',
    bloomLevel: 'Application',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Algebra, Equations & Logic Puzzles',
      description: 'Quadratic formulas, linear equations, exponential growth, and algorithmic problem-solving.',
      language: 'English',
      bloomLevel: 'Application',
      questions: [
        {
          prompt: 'For the quadratic equation ax² + bx + c = 0, what does the discriminant (b² - 4ac > 0) signify?',
          choices: ['Two distinct real roots', 'One repeated real root', 'Two complex imaginary roots', 'No mathematical solutions exist'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'When the discriminant b² - 4ac is strictly positive, the parabola intersects the x-axis at two distinct real coordinates.',
          time_limit_ms: 20000,
          bloom_level: 'Comprehension',
          imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'b² - 4ac = 0 produces one repeated root', 'b² - 4ac < 0 produces complex roots', 'Solutions always exist in the complex domain']
        },
        {
          prompt: 'If 2^(x + 3) = 64, what is the value of x?',
          choices: ['3', '6', '4', '2'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: '64 = 2^6. Equating exponents: x + 3 = 6 ➔ x = 3.',
          time_limit_ms: 20000,
          bloom_level: 'Application',
          misconceptions: ['', '6 is the exponent of 64 (2^6), but x + 3 = 6 requires subtracting 3', '4 results if dividing 64 by 16', '2 is an arithmetic miscalculation']
        },
        {
          prompt: 'What is the slope (m) of a line perpendicular to y = -2/3x + 5?',
          choices: ['3/2', '-2/3', '-3/2', '2/3'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Perpendicular lines have negative reciprocal slopes. The negative reciprocal of -2/3 is +3/2.',
          time_limit_ms: 20000,
          bloom_level: 'Application',
          misconceptions: ['', '-2/3 is the slope of parallel lines', '-3/2 is just reciprocal without flipping sign', '2/3 is only sign flip without reciprocal']
        },
        {
          prompt: 'A bacteria colony doubles every 3 hours. If starting with 100 bacteria, how many are present after 12 hours?',
          choices: ['1,600', '800', '1,200', '3,200'],
          correct_index: 0,
          difficulty: 'hard',
          explanation: '12 hours / 3 hours = 4 doublings. Population = 100 × 2^4 = 100 × 16 = 1,600.',
          time_limit_ms: 25000,
          bloom_level: 'Application',
          misconceptions: ['', '800 corresponds to 3 doublings (9 hours)', '1,200 is linear multiplication (100 × 12)', '3,200 corresponds to 5 doublings (15 hours)']
        },
        {
          prompt: 'What is the sum of the interior angles of a convex hexagon (6-sided polygon)?',
          choices: ['720°', '540°', '360°', '900°'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Sum = (n - 2) × 180° = (6 - 2) × 180° = 4 × 180° = 720°.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          misconceptions: ['', '540° is for a pentagon (5 sides)', '360° is for a quadrilateral (4 sides)', '900° is for a heptagon (7 sides)']
        }
      ]
    }
  },
  {
    id: 'founder_tech_fullstack',
    title: 'Modern Web Architecture & Fullstack',
    description: 'Next.js App Router, React memoization, database indexing, and API design.',
    category: 'Technology',
    tags: ['React', 'Next.js', 'Web Dev', 'Algorithms'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'medium',
    bloomLevel: 'Application',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Modern Web Architecture & Fullstack',
      description: 'Next.js App Router, React memoization, database indexing, and API design.',
      language: 'English',
      bloomLevel: 'Application',
      questions: [
        {
          prompt: 'In Next.js App Router, which directive marks a component to execute on the client with React state & hooks?',
          choices: ["'use client'", "'use dynamic'", "'use browser'", "'use state'"],
          correct_index: 0,
          difficulty: 'easy',
          explanation: "'use client' establishes the boundary between React Server Components and interactive client components.",
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'export const dynamic is a route segment config, not a component directive', 'use browser is not a valid React directive', 'use state is not a valid directive']
        },
        {
          prompt: 'What problem does React.memo() or useMemo() primarily prevent in heavy UI trees?',
          choices: ['Unnecessary re-renders when parent props or dependencies have not changed', 'Memory leaks from unclosed WebSocket connections', 'CSS specificity conflicts between tailwind classes', 'Cross-site scripting (XSS) payload execution'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'useMemo caches computation results and React.memo skips re-rendering when props are shallowly equal.',
          time_limit_ms: 20000,
          bloom_level: 'Comprehension',
          misconceptions: ['', 'useEffect cleanup functions prevent WebSocket leaks', 'CSS modules / scoped styles prevent style collisions', 'Sanitization and React JSX escaping prevent XSS']
        },
        {
          prompt: 'In relational databases (PostgreSQL), which index data structure is the default and optimal for range and equality queries?',
          choices: ['B-Tree (Balanced Tree)', 'Hash Index', 'Inverted Index (GIN)', 'R-Tree'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'B-Tree maintains sorted order with O(log n) searches, making it the versatile default for <, <=, =, >=, and > queries.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Hash indexes only support simple equality (=) and cannot handle range queries', 'GIN indexes are for full-text search and arrays/JSONB', 'R-Tree is for spatial/geometric coordinates']
        },
        {
          prompt: 'What is the time complexity of searching for a specific key in a standard JavaScript Hash Map (Map/Object)?',
          choices: ['O(1) average time', 'O(n) average time', 'O(log n) average time', 'O(n²) worst case always'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Hash maps compute a hash index in constant O(1) time on average.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          misconceptions: ['', 'O(n) is for linear array scans', 'O(log n) is for binary search trees', 'O(n²) is quadratic time']
        },
        {
          prompt: 'What is the primary architectural purpose of an idempotency key in payment and critical mutation APIs?',
          choices: ['Ensures retried requests do not trigger duplicate charges or double mutations', 'Encrypts user credit card numbers with AES-256', 'Compresses JSON payloads to reduce latency', 'Caches GET responses on CDN edge servers'],
          correct_index: 0,
          difficulty: 'hard',
          explanation: 'Idempotency keys allow safe retries after network timeouts without creating duplicate transactions.',
          time_limit_ms: 20000,
          bloom_level: 'Application',
          misconceptions: ['', 'TLS and tokenization secure card details', 'Gzip/Brotli handle payload compression', 'Cache-Control headers handle CDN caching']
        }
      ]
    }
  },
  {
    id: 'founder_hist_ancient',
    title: 'Ancient World Civilizations & Empires',
    description: 'Hieroglyphics, the Roman Empire, Indus Valley civilization, and classical architecture.',
    category: 'History',
    tags: ['Ancient Egypt', 'Rome', 'Greece', 'Civilization'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'medium',
    bloomLevel: 'Comprehension',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Ancient World Civilizations & Empires',
      description: 'Hieroglyphics, the Roman Empire, Indus Valley civilization, and classical architecture.',
      language: 'English',
      bloomLevel: 'Comprehension',
      questions: [
        {
          prompt: 'Which famous artifact, discovered in 1799, allowed modern linguists to decipher ancient Egyptian hieroglyphics?',
          choices: ['The Rosetta Stone', 'The Code of Hammurabi', 'The Dead Sea Scrolls', 'The Cyrus Cylinder'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'The Rosetta Stone contained the same decree in Egyptian hieroglyphs, Demotic, and Ancient Greek.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'Hammurabi Code is an ancient Babylonian legal text', 'Dead Sea scrolls are ancient Hebrew manuscripts', 'Cyrus Cylinder is an ancient Persian declaration']
        },
        {
          prompt: 'Who was the first Emperor of the Roman Empire, ruling from 27 BC until AD 14?',
          choices: ['Augustus (Octavian)', 'Julius Caesar', 'Nero', 'Marcus Aurelius'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Augustus was the first official Emperor of Rome, transitioning the Roman Republic into the Empire.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Julius Caesar was Dictator of the Republic, but never officially Emperor', 'Nero ruled later (AD 54-68)', 'Marcus Aurelius was the philosopher Emperor (AD 161-180)']
        },
        {
          prompt: 'The ancient Harappan civilization flourished around the basin of which major river system?',
          choices: ['Indus River', 'Nile River', 'Tigris & Euphrates', 'Yellow River (Huang He)'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'The Indus Valley Civilization (Harappa & Mohenjo-Daro) flourished around the Indus River basin in South Asia.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Nile River was the cradle of Ancient Egypt', 'Tigris and Euphrates sustained Mesopotamia', 'Yellow River sustained Ancient China']
        },
        {
          prompt: 'Which Greek philosopher was sentenced to death in 399 BC for "corrupting the youth" and impiety in Athens?',
          choices: ['Socrates', 'Plato', 'Aristotle', 'Pythagoras'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Socrates was tried in Athens and executed by drinking hemlock tea.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Plato was Socrates’ student and lived to old age', 'Aristotle was Plato’s student and tutor to Alexander the Great', 'Pythagoras was a pre-Socratic mathematician']
        },
        {
          prompt: 'What architectural engineering innovation enabled Romans to construct immense spans like the Pantheon dome and aqueducts?',
          choices: ['Hydraulic pozzolanic concrete and true curved arches', 'Steel reinforced pillars', 'Wooden cantilever trusses', 'Solid granite interlocking dry blocks'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Roman pozzolanic concrete (volcanic ash mix) combined with semi-circular arches allowed massive durable structures.',
          time_limit_ms: 20000,
          bloom_level: 'Comprehension',
          misconceptions: ['', 'Steel reinforcement was invented in the 19th century', 'Trusses were used in roofs but not the monumental domes/aqueducts', 'Interlocking dry blocks were used by Incas and Egyptians']
        }
      ]
    }
  },
  {
    id: 'founder_gen_space',
    title: 'Cosmology, Quantum Space & Earth Science',
    description: 'Black holes, orbital mechanics, planetary atmospheres, and the cosmic microwave background.',
    category: 'Science',
    tags: ['Astronomy', 'Physics', 'Space', 'Earth'],
    isFounder: true,
    authorName: 'QuizFlow Founders',
    difficulty: 'medium',
    bloomLevel: 'Comprehension',
    questionCount: 5,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    createdAt: Date.now() - 7 * 86400 * 1000,
    comments: [],
    quiz: {
      title: 'Cosmology, Quantum Space & Earth Science',
      description: 'Black holes, orbital mechanics, planetary atmospheres, and the cosmic microwave background.',
      language: 'English',
      bloomLevel: 'Comprehension',
      questions: [
        {
          prompt: 'What is the boundary around a black hole beyond which nothing, not even light, can escape?',
          choices: ['Event Horizon', 'Accretion Disk', 'Photon Sphere', 'Singularity'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'The event horizon is the point of no return where gravitational escape velocity exceeds the speed of light.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
          misconceptions: ['', 'Accretion disk is the glowing swirling matter outside the horizon', 'Photon sphere is where light orbits in unstable circles', 'Singularity is the infinite density point at the center']
        },
        {
          prompt: 'What is the most abundant gas in Earth’s atmosphere by volume (~78%)?',
          choices: ['Nitrogen (N2)', 'Oxygen (O2)', 'Argon (Ar)', 'Carbon Dioxide (CO2)'],
          correct_index: 0,
          difficulty: 'easy',
          explanation: 'Earth’s atmosphere is ~78% Nitrogen, ~21% Oxygen, ~0.93% Argon, and ~0.04% Carbon Dioxide.',
          time_limit_ms: 15000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Oxygen is ~21%', 'Argon is ~0.93%', 'Carbon Dioxide is ~0.04%']
        },
        {
          prompt: 'What pervasive cosmic radiation relic discovered in 1965 provides direct empirical evidence for the Big Bang?',
          choices: ['Cosmic Microwave Background (CMB)', 'Gamma Ray Bursts', 'Solar Wind Particles', 'Gravitational Waves'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'The CMB is the thermal echo remaining from the recombination epoch ~380,000 years after the Big Bang.',
          time_limit_ms: 20000,
          bloom_level: 'Comprehension',
          misconceptions: ['', 'Gamma ray bursts originate from collapsing hypernovas', 'Solar wind comes from our Sun', 'Gravitational waves are ripples in spacetime from mergers']
        },
        {
          prompt: 'Which planet in our solar system possesses the highest average surface temperature due to an extreme runaway greenhouse effect?',
          choices: ['Venus (~465°C)', 'Mercury', 'Mars', 'Jupiter'],
          correct_index: 0,
          difficulty: 'medium',
          explanation: 'Venus is hotter than Mercury despite being further from the Sun, due to its dense 96% CO2 atmosphere.',
          time_limit_ms: 20000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Mercury is closest to the Sun but lacks an atmosphere to trap heat at night', 'Mars is freezing cold with a thin atmosphere', 'Jupiter is a gas giant with cold upper clouds']
        },
        {
          prompt: 'What theoretical phenomenon predicts that black holes slowly lose mass and evaporate over trillions of years?',
          choices: ['Hawking Radiation', 'Hubble Expansion', 'Chandrasekhar Limit', 'Doppler Redshift'],
          correct_index: 0,
          difficulty: 'hard',
          explanation: 'Stephen Hawking showed quantum vacuum fluctuations near the event horizon cause thermal particle emission.',
          time_limit_ms: 25000,
          bloom_level: 'Recall',
          misconceptions: ['', 'Hubble expansion describes the stretching of the universe', 'Chandrasekhar limit is the max mass of a white dwarf (~1.4 solar masses)', 'Doppler redshift is the shifting of wavelengths from moving sources']
        }
      ]
    }
  }
]

// ── AI Auto-Categorizer Utility ─────────────────────────────────────
export function autoCategorizeQuiz(
  title: string,
  description?: string,
  questions?: Array<{ prompt: string }>
): { category: QuizCategory; tags: string[] } {
  const text = `${title} ${description || ''} ${questions?.map(q => q.prompt).join(' ') || ''}`.toLowerCase()

  const scores: Record<QuizCategory, number> = {
    All: 0,
    Sports: 0,
    Biology: 0,
    Mathematics: 0,
    Technology: 0,
    History: 0,
    Science: 0,
    'General Knowledge': 0
  }

  // Keywords mapping
  if (/football|soccer|cricket|basketball|tennis|olympic|fifa|nba|stadium|world cup|goal|athlete|sports|tournament|score|league|match/i.test(text)) {
    scores.Sports += 5
  }
  if (/bio|cell|mitochondria|dna|rna|gene|protein|organ|respiration|plant|animal|species|human body|anatomy|ecology|bacteria|virus/i.test(text)) {
    scores.Biology += 5
  }
  if (/math|algebra|equation|calculus|geometry|triangle|integral|derivative|probability|arithmetic|formula|polygon|angle|matrix/i.test(text)) {
    scores.Mathematics += 5
  }
  if (/code|javascript|python|react|next\.js|software|computer|web|api|algorithm|database|sql|cloud|developer|css|html|network/i.test(text)) {
    scores.Technology += 5
  }
  if (/history|empire|ancient|century|war|king|queen|civilization|egypt|rome|greece|treaty|revolution|president|dynasty/i.test(text)) {
    scores.History += 5
  }
  if (/science|physics|chemistry|quantum|space|astronomy|planet|star|galaxy|atom|molecule|gravity|energy|universe|earth/i.test(text)) {
    scores.Science += 5
  }

  let bestCategory: QuizCategory = 'General Knowledge'
  let maxScore = 0

  for (const [cat, score] of Object.entries(scores) as [QuizCategory, number][]) {
    if (cat !== 'All' && score > maxScore) {
      maxScore = score
      bestCategory = cat
    }
  }

  const tags: string[] = []
  if (bestCategory === 'Sports') tags.push('Athletics', 'Tournaments', 'Champions')
  else if (bestCategory === 'Biology') tags.push('Life Sciences', 'Genetics', 'Cellular')
  else if (bestCategory === 'Mathematics') tags.push('Problem Solving', 'Equations', 'Logic')
  else if (bestCategory === 'Technology') tags.push('Engineering', 'Coding', 'Architecture')
  else if (bestCategory === 'History') tags.push('Chronology', 'Civilizations', 'Milestones')
  else if (bestCategory === 'Science') tags.push('Cosmology', 'Discovery', 'Physics')
  else tags.push('Trivia', 'Curiosity', 'Quiz')

  return { category: bestCategory, tags }
}

// ── Store Accessors ───────────────────────────────────────────────

export function getCommunityQuizzes(): CommunityQuiz[] {
  if (typeof window === 'undefined') return FOUNDER_QUIZZES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: CommunityQuiz[] = JSON.parse(raw)
      const ids = new Set(parsed.map(q => q.id))
      const missingFounders = FOUNDER_QUIZZES.filter(f => !ids.has(f.id))
      return [...missingFounders, ...parsed]
    }
  } catch (err) {
    console.warn('Failed to read community quizzes from localStorage:', err)
  }
  return FOUNDER_QUIZZES
}

/**
 * Fetches globally published community quizzes from server API / Supabase.
 * Merges them into localStorage cache so any user sees quizzes globally in real time.
 */
export async function fetchRemoteCommunityQuizzes(): Promise<CommunityQuiz[]> {
  if (typeof window === 'undefined') return getCommunityQuizzes()
  try {
    const res = await fetch(`/api/community?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.quizzes && Array.isArray(data.quizzes)) {
        const local = getCommunityQuizzes()
        const localMap = new Map(local.map(q => [q.id, q]))
        
        for (const remoteQuiz of data.quizzes) {
          localMap.set(remoteQuiz.id, remoteQuiz)
        }

        const merged = Array.from(localMap.values())
        saveCommunityQuizzes(merged)
        return merged
      }
    }
  } catch (e) {
    console.warn('[fetchRemoteCommunityQuizzes Error]', e)
  }
  return getCommunityQuizzes()
}

export function saveCommunityQuizzes(quizzes: CommunityQuiz[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes))
  } catch (err) {
    console.warn('Failed to save community quizzes:', err)
  }
}

export function addQuizComment(quizId: string, authorName: string, rating: number, text: string): CommunityQuiz | null {
  const list = getCommunityQuizzes()
  const idx = list.findIndex(q => q.id === quizId)
  if (idx === -1) return null

  const newComment: QuizComment = {
    id: 'cmt_' + Date.now(),
    authorName: authorName.trim() || 'Learner',
    rating: Math.max(1, Math.min(5, rating)),
    text: text.trim(),
    createdAt: Date.now()
  }

  const currentComments = list[idx].comments || []
  const updatedComments = [newComment, ...currentComments]
  
  const totalRating = updatedComments.reduce((acc, c) => acc + c.rating, 0)
  const newAvgRating = Number((totalRating / updatedComments.length).toFixed(1))

  const updatedQuiz = {
    ...list[idx],
    comments: updatedComments,
    rating: newAvgRating,
    reviewCount: updatedComments.length
  }

  list[idx] = updatedQuiz
  saveCommunityQuizzes(list)

  // Sync comment update to server API
  if (typeof window !== 'undefined') {
    fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: updatedQuiz })
    }).catch(() => {})
  }

  return updatedQuiz
}

export function incrementQuizPlays(quizId: string): void {
  const list = getCommunityQuizzes()
  const idx = list.findIndex(q => q.id === quizId)
  if (idx !== -1) {
    const updated = {
      ...list[idx],
      playsCount: (list[idx].playsCount || 0) + 1
    }
    list[idx] = updated
    saveCommunityQuizzes(list)

    if (typeof window !== 'undefined') {
      fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz: updated })
      }).catch(() => {})
    }
  }
}

export function publishQuizToCommunity(quiz: AIGeneratedQuiz, authorName?: string): CommunityQuiz {
  const list = getCommunityQuizzes()
  const questions = quiz.questions || []
  const { category, tags } = autoCategorizeQuiz(quiz.title, quiz.description, questions)

  const newCommunityQuiz: CommunityQuiz = {
    id: 'comm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: quiz.title || 'Untitled Community Quiz',
    description: quiz.description || 'Interactive educational quiz created by the QuizFlow community.',
    category,
    tags,
    isFounder: false,
    authorName: authorName || 'Teacher Community Creator',
    difficulty: questions[0]?.difficulty || 'medium',
    bloomLevel: (quiz.bloomLevel as BloomLevel) || 'Comprehension',
    questionCount: questions.length,
    playsCount: 0,
    rating: 0,
    reviewCount: 0,
    quiz,
    comments: [],
    createdAt: Date.now()
  }

  const updatedList = [newCommunityQuiz, ...list]
  saveCommunityQuizzes(updatedList)

  // Sync published quiz globally via server API + direct Supabase client fallback
  if (typeof window !== 'undefined') {
    fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz: newCommunityQuiz })
    }).catch(() => {})

    // Direct Supabase sync guarantees cloud persistence even if API route is cold
    syncCommunityQuizToSupabase(newCommunityQuiz)
  }

  return newCommunityQuiz
}

