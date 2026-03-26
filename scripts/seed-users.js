import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
  'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
  'Emily', 'Daniel', 'Elizabeth', 'Matthew', 'Sofia', 'Jackson', 'Avery',
  'Sebastian', 'Ella', 'Jack', 'Scarlett', 'Aiden', 'Grace', 'Owen', 'Chloe',
  'Samuel', 'Victoria', 'David', 'Riley', 'Joseph', 'Aria', 'Carter', 'Lily'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

const SKILL_CATEGORIES = [
  {
    label: 'Technology',
    skills: ['Python', 'JavaScript', 'React', 'Machine Learning', 'Data Analysis', 'Web Design', 'Video Editing', 'Excel / Sheets'],
  },
  {
    label: 'Music',
    skills: ['Guitar', 'Piano', 'Drums', 'Singing', 'Music Production', 'Music Theory'],
  },
  {
    label: 'Art & Design',
    skills: ['Drawing', 'Oil Painting', 'Photography', 'Graphic Design', 'Pottery', 'Knitting'],
  },
  {
    label: 'Language',
    skills: ['Spanish', 'French', 'Mandarin', 'Arabic', 'Japanese', 'Sign Language'],
  },
  {
    label: 'Fitness',
    skills: ['Yoga', 'Rock Climbing', 'Running', 'Weightlifting', 'Dance'],
  },
  {
    label: 'Academic',
    skills: ['Calculus', 'Statistics', 'Chemistry', 'Economics', 'Essay Writing', 'Public Speaking'],
  },
  {
    label: 'Life Skills',
    skills: ['Cooking', 'Budgeting', 'Chess', 'Meditation'],
  },
];

const ALL_SKILLS = SKILL_CATEGORIES.flatMap(c => c.skills);

const AVAILABILITY_OPTIONS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'Mornings', 'Afternoons', 'Evenings',
];

const BIO_TEMPLATES = [
  "Passionate learner looking to expand my skillset and meet new people!",
  "Love teaching what I know and picking up new hobbies along the way.",
  "Always curious, always learning. Let's swap skills!",
  "Believer in lifelong learning and community knowledge sharing.",
  "Here to teach, learn, and grow together with others.",
  "Excited to share my expertise and learn something completely new.",
  "Skills are meant to be shared! Happy to help and learn.",
  "Making the most of my free time by learning from amazing people.",
  "Trading knowledge, building friendships, one skill at a time.",
  "Enthusiastic about personal growth through skill exchange.",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSubset(arr, minCount, maxCount) {
  const count = randomInt(minCount, maxCount);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateUser() {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@example.com`;
  
  // Generate 2-5 skills to teach with star ratings
  const teachSkills = randomSubset(ALL_SKILLS, 2, 5).map(skill => ({
    name: skill,
    stars: randomInt(2, 5)
  }));
  
  // Generate 2-4 skills to learn (different from teach skills)
  const teachSkillNames = teachSkills.map(s => s.name);
  const availableLearnSkills = ALL_SKILLS.filter(s => !teachSkillNames.includes(s));
  const learnSkills = randomSubset(availableLearnSkills, 2, 4);
  
  // Generate 3-7 availability slots
  const availability = randomSubset(AVAILABILITY_OPTIONS, 3, 7);
  
  return {
    email,
    password: 'password123', // Simple password for test users
    full_name: fullName,
    bio: randomItem(BIO_TEMPLATES),
    skills_teach: teachSkills,
    skills_learn: learnSkills,
    availability,
    points: randomInt(0, 500),
  };
}

async function createTestUser(userData) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) {
      console.error(`❌ Failed to create auth user ${userData.email}:`, authError.message);
      return null;
    }

    if (!authData.user) {
      console.error(`❌ No user returned for ${userData.email}`);
      return null;
    }

    // Update profile with additional data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: userData.full_name,
        bio: userData.bio,
        skills_teach: userData.skills_teach,
        skills_learn: userData.skills_learn,
        availability: userData.availability,
        points: userData.points,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error(`❌ Failed to update profile for ${userData.email}:`, profileError.message);
      return null;
    }

    console.log(`✅ Created user: ${userData.full_name} (${userData.email})`);
    console.log(`   Teaches: ${userData.skills_teach.map(s => s.name).join(', ')}`);
    console.log(`   Learns: ${userData.skills_learn.join(', ')}`);
    console.log(`   Points: ${userData.points}`);
    
    return authData.user;
  } catch (error) {
    console.error(`❌ Error creating user ${userData.email}:`, error);
    return null;
  }
}

async function seedUsers(count = 20) {
  console.log(`\n🌱 Seeding ${count} test users...\n`);
  
  const users = [];
  for (let i = 0; i < count; i++) {
    const userData = generateUser();
    const user = await createTestUser(userData);
    if (user) users.push(user);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✨ Successfully created ${users.length} out of ${count} users!`);
  console.log(`\n📝 All test users have password: password123`);
}

// Run the seeder
const userCount = process.argv[2] ? parseInt(process.argv[2]) : 20;
seedUsers(userCount).catch(console.error);
