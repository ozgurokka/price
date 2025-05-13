

const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

let previousPrice = null;
let latestPrice = null;


// Set the target URL and target price
const PRODUCT_URL = 'https://www.digitec.ch/en/s1/product/garmin-fenix-8-51-mm-smartwatches-48003012';
const TARGET_PRICE = parseFloat(process.env.TARGET_PRICE);
const ALERT_PRICE = parseFloat(process.env.ALERT_PRICE);
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
const usersFile = './users.json';


bot.setMyCommands([
  { command: '/start', description: 'Start and show menu' },
  { command: '/getprice', description: 'Show current target price' },
  { command: '/setprice', description: 'Set a new target price (e.g., /setprice 749)' },
  { command: '/checknow', description: 'Manually check price now' },
  { command: '/help', description: 'How to use the bot' }
]);

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  saveUser(chatId);
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  bot.sendMessage(chatId, `👋 Hello ${firstName}! I can track Garmin Fenix 8 prices for you.

Use these commands:
🔹 /getprice – Check current target price
🔹 /setprice 749 – Set new target price
🔹 /checknow – Manually check the price now
🔹 /help – Get help`, {
    reply_markup: {
      keyboard: [
        ['/getprice', '/checknow'],
        ['/setprice 749', '/help']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

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

bot.onText(/\/checknow/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔍 Checking current price...');
  try {
    await checkPrice(); // manually triggers your existing price checker
    bot.sendMessage(chatId, '✅ Price check complete.');
  } catch (error) {
    bot.sendMessage(chatId, '❌ Failed to check price.');
    console.error('Manual check error:', error);
  }
});


function saveUser(chatId) {
  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  }
  if (!users.includes(chatId)) {
    users.push(chatId);
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }
}

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

  const users = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));
  const targetPrice = getTargetPrice();
  const hour = new Date().getHours();
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

  if (latestPrice !== null) {
    previousPrice = latestPrice;
  }
  latestPrice = numericPrice;

  console.log( `current price ${numericPrice} `);
  console.log( `latestPrice ${latestPrice} `);
  console.log( `previousPrice ${previousPrice} `);

  //check if price changed
  if (previousPrice !== null && numericPrice < latestPrice) {
    console.log('✅ Price dropped since last check!');
    for (const userId of users) {
      bot.sendMessage(userId, ` 🔔🔔🔔 📉 Price dropped to CHF ${numericPrice} from CHF ${latestPrice} `, {
        parse_mode: 'Markdown'
      });
    }
  } else if (previousPrice !== null && numericPrice > latestPrice) {
    console.log('🔺 Price increased since last check.');
    for (const userId of users) {
      bot.sendMessage(userId, `📈 Price increased to CHF ${numericPrice} from CHF ${latestPrice} `, {
        parse_mode: 'Markdown'
      });
    }
  } else {
    console.log('➖ Price unchanged.');
  }
  
  console.log(`Current price: ${numericPrice} CHF`);

  //ALERT !!!
  if(ALERT_PRICE > numericPrice){
    const message = `🚨🚨🚨 🔥🔥🔥🔥 Huge drop! 🔥🔥🔥🔥🚨🚨🚨 `
    for (let i = 1; i <= 5; i++) {
      await sendTelegram(message);
    }
  }

  // Check if the price is below the target
  if (numericPrice < targetPrice) {
    console.log('🎯 Price is below target! Sending email...');
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);
    
    for (const email of ALERT_RECEIVERS) {
      await transporter.sendMail({
        from: `"Price Watcher" <${EMAIL_CONFIG.auth.user}>`,
        to: email,
        subject: '💰 Garmin Fenix 8 Price Drop Alert!',
        text: `Current price is CHF ${numericPrice}, below your target of CHF ${targetPrice}.\n\nCheck it here: ${PRODUCT_URL}`,
      });
      console.log(`📧 Email sent to ${email}`);
  }
    console.log('📧 Email sent!');

    const message = `🔥 *Garmin Fenix 8 Price Drop!*\n\nCurrent price: *CHF ${numericPrice}*\nTarget: CHF ${targetPrice}\n\n[View Product](${PRODUCT_URL})`;
    
    //await sendTelegram(message);

    for (const userId of users) {
      bot.sendMessage(userId, message, {
        parse_mode: 'Markdown'
      });
    }
    console.log('📲 Telegram message sent!');
    
  } else {
    console.log('Price is still above target. No email sent.');
  }
  await browser.close();
}

// 🔁 Run immediately
checkPrice();

const cron = require('node-cron');

cron.schedule('0 * * * *', () => {
  console.log('🕒 Hourly check started at', new Date().toLocaleTimeString());
  checkPrice();
});


