require('dotenv').congfig();

const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/payments.js');
const userRoutes = require('./routes/users.js');

const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors());
app.use(express.json());

app.use('api/payments', paymentRoutes);
app.use('api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});