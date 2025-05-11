const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

// Set the target URL and target price
const PRODUCT_URL = 'https://www.digitec.ch/en/s1/product/garmin-fenix-8-51-mm-smartwatches-48003012';
const TARGET_PRICE = 800.00;

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'ozgurokka2003@gmail.com',
    pass: 'adeb gnzg jmwz vioa', // Gmail App Password
  },
};

const ALERT_RECEIVER = 'ozgurokka2003@gmail.com';

// Main price check function
async function checkPrice() {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) {
    console.log(`⏱ Skipping check at ${hour}:00 (quiet hours)`);
    return;
  }
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });

  // Get the price
  await page.waitForSelector('button.yKEoTuX6');
  const priceText = await page.$eval('button.yKEoTuX6', el => el.innerText);
  const numericPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));

  console.log(`Current price: ${numericPrice} CHF`);

  // Check if the price is below the target
  if (numericPrice < TARGET_PRICE) {
    console.log('🎯 Price is below target! Sending email...');

    const transporter = nodemailer.createTransport(EMAIL_CONFIG);
    await transporter.sendMail({
      from: `"Price Watcher" <${EMAIL_CONFIG.auth.user}>`,
      to: ALERT_RECEIVER,
      subject: 'Garmin Fenix 8 Price Drop Alert',
      text: `Current price is CHF ${numericPrice}\nTarget was CHF ${TARGET_PRICE}\n\nLink: ${PRODUCT_URL}`,
    });

    console.log('📧 Email sent!');
  } else {
    console.log('Price is still above target. No email sent.');
  }

  await browser.close();
}

// 🔁 Run immediately
checkPrice();
// Run the price check periodically (every 6 hours)
setInterval(checkPrice, 1 * 60 * 60 * 1000);

