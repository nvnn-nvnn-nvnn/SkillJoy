import { useRef, useState, useEffect, useCallback } from 'react';



// const DEFAULT_CATEGORIES = [
//     { label: 'Tutoring', emoji: '📚', query: 'tutoring' },
//     { label: 'Languages', emoji: '🌍', query: 'language' },
//     { label: 'Coding', emoji: '💻', query: 'coding' },
//     { label: 'Design', emoji: '🎨', query: 'design' },
//     { label: 'Music', emoji: '🎵', query: 'music' },
//     { label: 'Fitness', emoji: '👟', query: 'fitness' },
//     { label: 'Cooking', emoji: '🍳', query: 'cooking' },
//     { label: 'Photography', emoji: '📸', query: 'photography' },
//     { label: 'Writing', emoji: '✍️', query: 'writing' },
//     { label: 'Business', emoji: '💼', query: 'business' },
// ];


const DEFAULT_CATEGORIES = [
    { label: 'Spanish', emoji: '🇪🇸', query: 'spanish' },
    { label: 'French', emoji: '🇫🇷', query: 'french' },
    { label: 'Calculus', emoji: '📐', query: 'calculus' },
    { label: 'Statistics', emoji: '📊', query: 'statistics' },
    { label: 'Chemistry', emoji: '⚗️', query: 'chemistry' },
    { label: 'Economics', emoji: '📈', query: 'economics' },
    { label: 'Python', emoji: '🐍', query: 'python' },
    { label: 'JavaScript', emoji: '💛', query: 'javascript' },
    { label: 'Essay Writing', emoji: '✍️', query: 'essay writing' },
    { label: 'Data Analysis', emoji: '🔬', query: 'data analysis' },
    { label: 'Photography', emoji: '📸', query: 'photography' },
    { label: 'Graphic Design', emoji: '🎨', query: 'graphic design' },
    { label: 'Video Editing', emoji: '🎬', query: 'video editing' },
    { label: 'Drawing', emoji: '✏️', query: 'drawing' },
    { label: 'Singing', emoji: '🎤', query: 'singing' },
    { label: 'Guitar', emoji: '🎸', query: 'guitar' },
    { label: 'Piano', emoji: '🎹', query: 'piano' },
    { label: 'Music Production', emoji: '🎧', query: 'music production' },
    { label: 'Weightlifting', emoji: '🏋️', query: 'weightlifting' },
    { label: 'Running', emoji: '👟', query: 'running' },
    { label: 'Yoga', emoji: '🧘', query: 'yoga' },
    { label: 'Dance', emoji: '💃', query: 'dance' },
    { label: 'Cooking', emoji: '🍳', query: 'cooking' },
    { label: 'Budgeting', emoji: '💰', query: 'budgeting' },
    { label: 'Public Speaking', emoji: '🎙️', query: 'public speaking' },
    { label: 'React', emoji: '⚛️', query: 'react' },
    { label: 'Web Design', emoji: '🖥️', query: 'web design' },
    { label: 'Machine Learning', emoji: '🤖', query: 'machine learning' },
];



export default function SliderSearch({ onCategorySelect, categories = DEFAULT_CATEGORIES }) {
    const [selectedCategory, setSelectedCategory] = useState(null);


    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '0.5rem',
            maxWidth: '100%',
        }}
        >
            <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: "var(--text)" }}>Categories</span>

            <div
                style={{
                    display: 'flex',
                    gap: '1rem',
                    overflowX: 'auto',
                    padding: '1rem',
                }}
            >

                {
                    categories.map(category => (
                        <div
                            key={category.label}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '0.5rem 1rem',
                                border: '2px solid #c99772',
                                backgroundColor: '#fff',
                                borderRadius: '18px',
                                cursor: 'pointer',
                                minWidth: 'fit-content',
                                flexShrink: 0,
                                fontFamily: 'inherit',
                                fontSize: '0.875rem',

                            }}
                            onClick={() => onCategorySelect(category.query)}
                        >
                            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{category.emoji}</span>
                            <span>{category.label}</span>
                        </div>
                    ))

                }


            </div>


        </div>
    );
}