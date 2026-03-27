const express = require('express');
const router = express.Router();

// Payments

const { createPaymentIntent, releaseFunds } = require('../services/payments');
const { createEscrowTransaction, updateEscrowStatus } = require('..services/payments');


