const express = require('express');
const Stripe = require('stripe');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalSecret = process.env.PAYPAL_SECRET;
const supportUrl = process.env.SUPPORT_URL || 'https://buymeacoffee.com';

app.use(express.json());
app.use(express.static(__dirname));

function coerceSupportAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 5;
  }
  return Number(Math.min(250, Math.max(5, numericValue)).toFixed(2));
}

function createPaypalClient() {
  if (!paypalClientId || !paypalSecret) {
    return null;
  }

  const environment = new paypal.core.SandboxEnvironment(paypalClientId, paypalSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

function getSupportLink(amount) {
  const normalizedAmount = coerceSupportAmount(amount);
  const encoded = encodeURIComponent(JSON.stringify({ amount: normalizedAmount, source: 'real-pay-tracker' }));
  return `${supportUrl}?utm_source=real-pay-tracker&utm_medium=support&utm_amount=${normalizedAmount}&ref=${encoded}`;
}

app.get('/api/support', async (req, res) => {
  const amount = coerceSupportAmount(req.query.amount);

  if (!stripeSecretKey && !paypalClientId && !paypalSecret) {
    return res.json({
      provider: 'link',
      url: getSupportLink(amount),
      amount,
      note: 'No payment keys are configured, so this falls back to a simple support link.',
    });
  }

  const preferredProvider = String(req.query.provider || 'stripe').toLowerCase();

  if (preferredProvider === 'paypal' && paypalClientId && paypalSecret) {
    try {
      const client = createPaypalClient();
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
          description: 'Support Real Pay Tracker',
        }],
        application_context: {
          brand_name: 'Real Pay Tracker',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${req.protocol}://${req.get('host')}/support/thanks`,
          cancel_url: `${req.protocol}://${req.get('host')}/support/cancelled`,
        },
      });

      const response = await client.execute(request);
      const order = response.result;
      const approvalUrl = order.links?.find(link => link.rel === 'approve')?.href;

      return res.json({
        provider: 'paypal',
        url: approvalUrl || getSupportLink(amount),
        amount,
      });
    } catch (error) {
      return res.json({ provider: 'link', url: getSupportLink(amount), amount, note: 'PayPal setup failed; falling back to support link.' });
    }
  }

  if (stripeSecretKey) {
    try {
      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Support Real Pay Tracker',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        success_url: `${req.protocol}://${req.get('host')}/support/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/support/cancelled`,
        metadata: { source: 'real-pay-tracker', amount: String(amount) },
      });

      return res.json({ provider: 'stripe', url: session.url, amount });
    } catch (error) {
      return res.json({ provider: 'link', url: getSupportLink(amount), amount, note: 'Stripe setup failed; falling back to support link.' });
    }
  }

  return res.json({ provider: 'link', url: getSupportLink(amount), amount });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, coerceSupportAmount, getSupportLink };
