

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');


// Set the target URL and target price
const PRODUCT_URL = 'https://www.digitec.ch/en/s1/product/garmin-fenix-8-51-mm-smartwatches-48003012';
const TARGET_PRICE = parseFloat(process.env.TARGET_PRICE);
const ALERT_RECEIVERS = process.env.ALERT_RECEIVERS.split(',').map(email => email.trim());

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'ozgurokka2003@gmail.com',
    pass: 'adeb gnzg jmwz vioa', // Gmail App Password
  },
};

const ALERT_RECEIVER = 'ozgurokka2003@gmail.com';

const PRICE_FILE = './target-price.json';
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const chatId = process.env.CHAT_ID;

function getTargetPrice() {
  try {
    const data = JSON.parse(fs.readFileSync(PRICE_FILE));
    return data.targetPrice;
  } catch {
    return parseFloat(process.env.TARGET_PRICE || TARGET_PRICE);
  }
}

function setTargetPrice(newPrice) {
  fs.writeFileSync(PRICE_FILE, JSON.stringify({ targetPrice: newPrice }, null, 2));
}

bot.onText(/\/setprice (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const price = parseFloat(match[1]);

  if (isNaN(price)) {
    bot.sendMessage(chatId, '❌ Invalid price. Use like: /setprice 749');
  } else {
    setTargetPrice(price);
    bot.sendMessage(chatId, `✅ Target price updated to CHF ${price}`);
  }
});

bot.onText(/\/getprice/, (msg) => {
  const price = getTargetPrice();
  bot.sendMessage(msg.chat.id, `🎯 Current target price is CHF ${price}`);
});

const sendTelegram = async (message) => {
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  const json = await res.json();
  if (!json.ok) {
    console.error('❌ Telegram error:', json);
  }
};

// Main price check function
async function checkPrice() {

  const targetPrice = getTargetPrice();
  
  const hour = new Date().getHours();
  /*if (hour >= 0 && hour < 6) {
    console.log(`⏱ Skipping check at ${hour}:00 (quiet hours)`);
    return;
  }*/
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });

  // Get the price
 /* await page.waitForSelector('button.yKEoTuX6');
  const priceText = await page.$eval('button.yKEoTuX6', el => el.innerText);
  const numericPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));*/

await page.waitForXPath('//*[@id="pageContent"]/div/div[1]/div[1]/div/div[2]/div/div[1]/span/strong/button');

// Find the button using the provided XPath
const [priceButton] = await page.$x('//*[@id="pageContent"]/div/div[1]/div[1]/div/div[2]/div/div[1]/span/strong/button');

if (!priceButton) {
  throw new Error('❌ Price button not found using XPath');
}

// Extract the price text from the button
const priceText = await page.evaluate(button => button.innerText, priceButton);

// Clean the price text to get a numeric value
const numericPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));
  
  console.log(`Current price: ${numericPrice} CHF`);

  // Check if the price is below the target
  if (numericPrice < targetPrice) {
    console.log('🎯 Price is below target! Sending email...');

    const transporter = nodemailer.createTransport(EMAIL_CONFIG);


    for (const email of ALERT_RECEIVERS) {
      await transporter.sendMail({
        from: `"Price Watcher" <${EMAIL_CONFIG.auth.user}>`,
        to: email,
        subject: '💰 Garmin Fenix 8 Price Drop Alert!',
        text: `Current price is CHF ${numericPrice}, below your target of CHF ${TARGET_PRICE}.\n\nCheck it here: ${PRODUCT_URL}`,
      });
      console.log(`📧 Email sent to ${email}`);
  }

    console.log('📧 Email sent!');

    const message = `🔥 *Garmin Fenix 8 Price Drop!*\n\nCurrent price: *CHF ${numericPrice}*\nTarget: CHF ${TARGET_PRICE}\n\n[View Product](${PRODUCT_URL})`;
    await sendTelegram(message);
    console.log('📲 Telegram message sent!');
    
  } else {
    console.log('Price is still above target. No email sent.');
  }

  await browser.close();
}

// 🔁 Run immediately
checkPrice();

//setInterval(checkPrice, 1 * 60 * 60 * 1000);

//setInterval(checkPrice, 5 * 60 * 1000); // every 5 minutes

const cron = require('node-cron');

// Schedule: every hour from 06:00 to 23:00
cron.schedule('0 6-23 * * *', () => {
  console.log('🕒 Scheduled check started at', new Date().toLocaleTimeString());
  checkPrice();
});


