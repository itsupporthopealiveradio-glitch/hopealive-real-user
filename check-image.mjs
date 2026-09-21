import fs from 'fs';
function getSize(file) {
  const buf = fs.readFileSync(file);
  // very hacky PNG size grabber:
  // IHDR starts at byte 12. 
  // Width is 4 bytes at byte 16. Height is 4 bytes at byte 20.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  console.log(`${file}: ${width}x${height} (Ratio: ${height/width})`);
}
getSize('c:\\Users\\USER\\Downloads\\attendance_spreadsheet_v2.png');
getSize('c:\\Users\\USER\\Downloads\\attendance_spreadsheet_updated.png');
