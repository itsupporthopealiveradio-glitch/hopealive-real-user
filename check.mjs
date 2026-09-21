import fs from 'fs';
const bytes = fs.readFileSync('c:\\Users\\USER\\Downloads\\user ux\\public\\tbg-logo.png').subarray(0, 8);
console.log(bytes.toString('hex'));
