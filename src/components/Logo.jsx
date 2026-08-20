// ── Brand mark ───────────────────────────────────────────────────────────────
// Inlined rather than imported as an <img> so both halves can track CSS
// variables, which an external <img src="*.svg"> can never do:
//   · "Skill" follows --accent  → a brand swap needs no new asset (the old
//     skilljoy-green.svg was a flat #93E9BE and went stale the moment the
//     palette moved off green)
//   · "Joy"   follows --text    → the old asset left this half unstyled, i.e.
//     flat black, which vanished against the dark surface in dark mode
// Sized by height; width follows the 726.1×205.4 viewBox.
export default function Logo({ height = 30, className = '' }) {
  return (
    <svg
      viewBox="0 0 726.1 205.4"
      height={height}
      className={className}
      role="img"
      aria-label="SkillJoy"
      style={{ width: 'auto', display: 'block' }}
    >
      <g fill="var(--accent)">
        <path d="M86,57.1c-6.5-5.4-14.8-9-23.4-9c-6.5,0-15.1,3.8-15.1,11.3c0,7.9,9.5,11,15.7,13l9,2.7c18.9,5.6,33.5,15.1,33.5,37.1c0,13.5-3.2,27.4-14,36.5c-10.6,9-24.8,12.8-38.5,12.8c-17.1,0-33.8-5.8-47.7-15.5l15.1-28.4c8.8,7.7,19.3,14,31.3,14c8.3,0,17.1-4.1,17.1-13.7c0-9.9-13.9-13.3-21.4-15.5c-22.1-6.3-36.7-12.1-36.7-38.3c0-27.5,19.6-45.5,46.8-45.5c13.7,0,30.4,4.3,42.5,11.2L86,57.1z" />
        <path d="M154.4,98.8l34-33.3h44.8L187,108.2l49.1,49.7h-45.9l-35.8-37.6v37.6h-32.8V8.5h32.8V98.8z" />
        <path d="M280.3,30.1c0,10.1-8.3,18.4-18.4,18.4c-10.1,0-18.4-8.3-18.4-18.4c0-10.1,8.3-18.4,18.4-18.4C272,11.7,280.3,20,280.3,30.1z M278.3,157.9h-32.8V65.5h32.8V157.9z" />
        <path d="M332.6,157.9h-32.8V8.5h32.8V157.9z" />
        <path d="M387,157.9h-32.8V8.5H387V157.9z" />
      </g>
      <g fill="var(--text)">
        <path d="M475,22.1v91.6c0,28.6-14.9,47.7-45,47.7c-15.1,0-26.8-7.6-34.9-20l20.3-21.4c4,5.4,9.5,11.5,14.2,11.5c10.4,0,10.1-12.4,10.1-20V22.1H475z" />
        <path d="M601,111.8c0,31.3-25.9,49.1-55.6,49.1c-29.5,0-55.6-17.6-55.6-49.1c0-31.5,25.9-49.3,55.6-49.3C575.1,62.5,601,80.3,601,111.8z M524.3,111.8c0,11.7,7.7,20.7,21.1,20.7c13.3,0,21.1-9,21.1-20.7c0-11.3-7.7-20.9-21.1-20.9C532.1,90.9,524.3,100.4,524.3,111.8z" />
        <path d="M602.3,65.5h37.8l24.7,47.3l24.1-47.3h37.3l-74,138.4h-36.7l31.5-58.7L602.3,65.5z" />
      </g>
    </svg>
  );
}
