# SkillEditor — Browse Skills Modal

## Why
The SkillEditor previously only had a freetext input for adding skills. The app has a preset catalogue of skills (from onboarding) that users could originally browse by category — this was lost after the onboarding redesign. Users needed a way to pick from the same preset list without having to type skill names from memory.

---

## What
Added a "Browse ✦" button next to the existing text input in `src/components/Skillededitor.jsx`. Clicking it opens a modal showing all 7 skill categories (Technology, Music, Art & Design, Language, Fitness, Academic, Life Skills) as toggleable chip buttons — the same `SKILL_CATEGORIES` data used in onboarding. Skills already in the user's list are pre-highlighted with a checkmark. A "Done" button at the bottom closes the modal and shows the running selected count.

The freetext input remains for custom skills not in the preset list.

---

## How

Imported `SKILL_CATEGORIES` and `hasSkill` from `@/lib/stores`. Added `showModal` state. Added a `toggleFromModal(name)` function that handles both modes:
- `type="teach"` — uses `hasSkill` / `setSkillStars` / `removeSkill` (skills stored as `{name, stars}` objects)
- `type="learn"` — plain string includes/filter

```jsx
function toggleFromModal(name) {
    if (type === 'teach') {
        onChange(hasSkill(skills, name) ? removeSkill(skills, name) : setSkillStars(skills, name, 3));
    } else {
        const selected = skills.includes(name);
        onChange(selected ? skills.filter(s => s !== name) : [...skills, name]);
    }
}
```

The modal is a fixed-position backdrop with a scrollable inner panel. Categories are rendered as labelled sections with pill chips. Selected state is read live from the `skills` prop so toggling is immediately reflected without needing a separate local draft state.
