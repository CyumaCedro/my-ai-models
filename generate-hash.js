const bcrypt = require('bcrypt');

async function generateHash() {
    const password = '1234';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password hash for "1234":', hash);
}

generateHash().catch(console.error);