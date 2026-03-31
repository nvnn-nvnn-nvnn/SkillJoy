import React from "react";

function Contact() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [focused, setFocused] = React.useState(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    formData.append("access_key", "ad2c4b5d-a388-4282-9176-bcceba54b851");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        console.error("Form submission failed:", data);
        alert("Failed to send message. Please try again.");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${focused === field ? "#0FD980" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 8,
    color: "#f5f5f5",
    outline: "none",
    fontFamily: "'JetBrains Mono', monospace",
    caretColor: "#0FD980",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focused === field ? "0 0 16px rgba(15,217,128,0.1)" : "none",
    boxSizing: "border-box",
  });

  const labelStyle = {
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)",
    marginBottom: 6,
    display: "block",
    fontFamily: "'JetBrains Mono', monospace",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@300;400;500&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(15,217,128,0.3); }
          50%       { box-shadow: 0 0 24px rgba(15,217,128,0.7); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Background glow */}
        <div style={{
          position: "absolute", top: "-20%", left: "-10%",
          width: "50%", height: "50%", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(15,217,128,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: "40%", height: "40%", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(120,163,255,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          width: "100%", maxWidth: 560,
          animation: "fadeUp 0.6s ease-out both",
        }}>

          {submitted ? (
            <div style={{
              background: "#0A0C10",
              border: "1px solid rgba(15,217,128,0.3)",
              borderRadius: 16, padding: "48px 40px",
              textAlign: "center",
              animation: "fadeUp 0.5s ease-out both",
            }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "#f5f5f5",
                fontFamily: "'Orbitron', sans-serif", marginBottom: 12,
              }}>
                Message Sent
              </div>
              <p style={{
                fontSize: 14, color: "rgba(255,255,255,0.5)",
                lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace",
              }}>
                Thanks for reaching out, <span style={{ color: "#0FD980" }}>{name}</span>.<br />
                We'll get back to you at {email} shortly.
              </p>
              <button
                onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); }}
                style={{
                  marginTop: 28, padding: "10px 24px", fontSize: 11,
                  letterSpacing: 2, textTransform: "uppercase",
                  borderRadius: 8, border: "1px solid rgba(15,217,128,0.4)",
                  background: "transparent", color: "#0FD980",
                  cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(15,217,128,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                Send Another
              </button>
            </div>
          ) : (
            <div style={{
              background: "#0A0C10",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, overflow: "hidden",
            }}>

              {/* Header bar */}
              <div style={{
                padding: "28px 36px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "5px 12px", borderRadius: 999,
                  border: "1px solid rgba(15,217,128,0.3)",
                  background: "rgba(15,217,128,0.06)",
                  fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase",
                  color: "#0FD980", fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 16,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0FD980", animation: "pulseGlow 2s infinite" }} />
                  Get In Touch
                </div>
                <h1 style={{
                  fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900,
                  letterSpacing: -0.5, margin: 0, lineHeight: 1.1,
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  Contact Us
                </h1>
                <p style={{
                  fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10,
                  lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 300,
                }}>
                  Have a question, partnership idea, or just want to say hi? We'd love to hear from you.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ padding: "28px 36px 36px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Hidden inputs for Web3Forms email configuration */}
                <input type="hidden" name="subject" value={`New message from ${name}`} />
                <input type="hidden" name="from_name" value="Tech Kage Contact Form" />
                <input type="hidden" name="replyto" value={email} />

                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    placeholder="Your name"
                    style={inputStyle("name")}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    style={inputStyle("email")}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Message</label>
                  <textarea
                    name="message"
                    required
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused(null)}
                    placeholder="What's on your mind?"
                    rows={5}
                    style={{ ...inputStyle("message"), resize: "vertical", minHeight: 120 }}
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: "100%", padding: "13px",
                    fontSize: 12, fontWeight: 700, letterSpacing: 2.5,
                    textTransform: "uppercase", borderRadius: 8,
                    border: "1px solid rgba(15,217,128,0.9)",
                    background: loading ? "transparent" : "#0FD980",
                    color: loading ? "#0FD980" : "#050608",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "#1BF08E"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                  onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = "#0FD980"; e.currentTarget.style.transform = "translateY(0)"; } }}
                >
                  {loading ? "Sending..." : "Send Message →"}
                </button>

              </form>
            </div>
          )}

          {/* Contact info row */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 32,
            marginTop: 28, flexWrap: "wrap",
          }}>
            {[
              { label: "Email", value: "TechKage@Proton.me" },
              { label: "Response time", value: "Within 24hrs" },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: "#0FD980", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}

export default Contact;
