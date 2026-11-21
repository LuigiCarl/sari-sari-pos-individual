const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local first if it exists, then fallback/supplement with .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();
