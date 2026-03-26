import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Skills catalogue (from original Svelte stores.js) ───────────────────────
export const SKILL_CATEGORIES = [
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
]

export const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills)

export const AVAILABILITY_OPTIONS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'Mornings', 'Afternoons', 'Evenings',
]

// ── Helper functions ────────────────────────────────────────────────────────

/** Robustly extract a skill name from any format: plain string, {name,stars} object, or stringified JSON */
export function getSkillName(s) {
  if (!s) return ''
  if (typeof s === 'object' && s.name) return s.name
  if (typeof s === 'string') {
    if (s.startsWith('{')) {
      try { return JSON.parse(s).name || s } catch { return s }
    }
    return s
  }
  return String(s)
}

/** Normalize skills array - convert stringified JSON to proper objects and deduplicate */
export function normalizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return []

  const normalized = skills.map(s => {
    if (typeof s === 'string' && s.startsWith('{')) {
      try { return JSON.parse(s) } catch { return s }
    }
    return s
  })

  // Deduplicate by skill name
  const seen = new Set()
  return normalized.filter(s => {
    const name = typeof s === 'string' ? s : s.name
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
}

export function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function teachNames(skillsTeach) {
  if (!skillsTeach) return []
  return skillsTeach.map((s) => (typeof s === 'string' ? s : s.name))
}

export function getStars(skillsTeach, name) {
  if (!skillsTeach) return 3
  const found = skillsTeach.find((s) => (typeof s === 'string' ? s : s.name) === name)
  if (!found) return 3
  return typeof found === 'string' ? 3 : (found.stars ?? 3)
}

export function setSkillStars(skillsTeach, name, stars) {
  const arr = skillsTeach ?? []
  const exists = arr.find((s) => (typeof s === 'string' ? s : s.name) === name)
  if (exists) {
    return arr.map((s) =>
      (typeof s === 'string' ? s : s.name) === name ? { name, stars } : s
    )
  }
  return [...arr, { name, stars }]
}

export function removeSkill(skillsTeach, name) {
  return (skillsTeach ?? []).filter((s) => (typeof s === 'string' ? s : s.name) !== name)
}

export function hasSkill(skillsTeach, name) {
  return (skillsTeach ?? []).some((s) => (typeof s === 'string' ? s : s.name) === name)
}

export function overlapScore(teachRated, learnList) {
  if (!teachRated || !learnList) return 0
  let total = 0
  for (const skill of learnList) {
    const entry = teachRated.find((s) => (typeof s === 'string' ? s : s.name) === skill)
    if (entry) {
      const stars = typeof entry === 'string' ? 3 : (entry.stars ?? 3)
      total += stars / 5
    }
  }
  return total
}

export function overlapCount(a, b) {
  if (!a || !b) return 0
  const aNames = Array.isArray(a) ? a.map((s) => (typeof s === 'string' ? s : s.name)) : a
  return aNames.filter((x) => b.includes(x)).length
}

// ── React Auth Context (replaces Svelte writable stores) ────────────────────

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      // Normalize skills arrays to handle stringified JSON
      if (data) {
        data.skills_teach = normalizeSkills(data.skills_teach)
        data.skills_learn = normalizeSkills(data.skills_learn)
      }

      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useUser() {
  const { user } = useAuth()
  return user
}

export function useProfile() {
  const { profile } = useAuth()
  return profile
}
