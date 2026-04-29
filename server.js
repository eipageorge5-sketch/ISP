const express = require('express');
const axios = require('axios');
const { Routeros } = require('routeros-node');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. GET ACCESS TOKEN FROM SAFARICOM
const getAccessToken = async () => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
    });
    return res.data.access_token;
};

// 2. TRIGGER STK PUSH (When user clicks "Pay" on your portal)
app.post('/pay', async (req, res) => {
    const phone = req.body.phone; // e.g., 254700023496
    const amount = req.body.amount;
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString('base64');

    try {
        const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
            "BusinessShortCode": process.env.MPESA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone,
            "PartyB": process.env.MPESA_SHORTCODE,
            "PhoneNumber": phone,
            "CallBackURL": process.env.MPESA_CALLBACK_URL,
            "AccountReference": "NMA.WIFI",
            "TransactionDesc": "WiFi Payment"
        }, { headers: { Authorization: `Bearer ${token}` } });

        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// 3. CALLBACK HANDLER (Safaricom calls this when PIN is entered)
app.post('/callback', async (req, res) => {
    const result = req.body.Body.stkCallback;
    
    if (result.ResultCode === 0) {
        const phone = result.CallbackMetadata.Item.find(i => i.Name === "PhoneNumber").Value;
        console.log(`Payment successful for ${phone}. Unlocking Internet...`);
        
        // UNLOCK MIKROTIK
        const router = new Routeros({
            host: process.env.ROUTER_HOST,
            user: process.env.ROUTER_USER,
            password: process.env.ROUTER_PASS
        });

        try {
            const conn = await router.connect();
            // Add user to hotspot with a 1-hour limit
            await conn.write(['/ip/hotspot/user/add', `=name=${phone}`, `=limit-uptime=1h`]);
            console.log("MikroTik Updated!");
        } catch (err) {
            console.error("Router error:", err);
        }
    }
    res.status(200).send("OK");
});

app.listen(3000, () => console.log('ISP Backend running on port 3000'));
