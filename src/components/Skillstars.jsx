export default function SkillStars({ stars = 3, readonly = false, size = 'sm', onChange }) {
    const sizes = { sm: 14, md: 18, lg: 24 };
    const px = sizes[size] ?? 14;

    return (
        <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <span
                    key={i}
                    onClick={() => !readonly && onChange?.(i)}
                    style={{
                        fontSize: px,
                        color: i <= stars ? '#f59e0b' : '#d1d5db',
                        cursor: readonly ? 'default' : 'pointer',
                        lineHeight: 1,
                        transition: 'color 0.15s',
                    }}
                >
                    ★
                </span>
            ))}
        </div>
    );
}