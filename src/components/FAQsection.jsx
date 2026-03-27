import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'; // or any icon library

const FAQSection = ({ faqs, setFaqs }) => {
    const [openIndex, setOpenIndex] = useState(null);

    // Add new FAQ
    const addFaq = () => {
        setFaqs([...faqs, { question: '', answer: '' }]);
        setOpenIndex(faqs.length); // open the newly added one
    };

    // Remove FAQ
    const removeFaq = (index) => {
        const updatedFaqs = faqs.filter((_, i) => i !== index);
        setFaqs(updatedFaqs);
        if (openIndex === index) setOpenIndex(null);
        else if (openIndex > index) setOpenIndex(openIndex - 1);
    };

    // Update FAQ
    const updateFaq = (index, field, value) => {
        const updatedFaqs = [...faqs];
        updatedFaqs[index][field] = value;
        setFaqs(updatedFaqs);
    };

    return (
        <div className="field">
            <label htmlFor="gig-faq">
                FAQ <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>

            <div className="faq-container">
                {faqs.map((faq, index) => (
                    <div key={index} className="faq-item">
                        <div
                            className="faq-header"
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                        >
                            <div className="faq-question">
                                {faq.question || `FAQ ${index + 1}`}
                            </div>
                            <button type="button" className="faq-toggle">
                                {openIndex === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                        </div>

                        {openIndex === index && (
                            <div className="faq-content">
                                <div className="input-group">
                                    <label>Question</label>
                                    <input
                                        type="text"
                                        value={faq.question}
                                        onChange={(e) => updateFaq(index, 'question', e.target.value)}
                                        placeholder="e.g. What is the delivery time?"
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Answer</label>
                                    <textarea
                                        value={faq.answer}
                                        onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                                        rows={3}
                                        placeholder="e.g. Delivery usually takes 2-5 business days..."
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="remove-btn"
                                    onClick={() => removeFaq(index)}
                                >
                                    <Trash2 size={16} /> Remove FAQ
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addFaq}
                    className="add-faq-btn"
                >
                    <Plus size={18} />
                    Add FAQ
                </button>
            </div>

            <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px', display: 'block' }}>
                Add frequently asked questions for your gig
            </small>
        </div>
    );
};

export default FAQSection;