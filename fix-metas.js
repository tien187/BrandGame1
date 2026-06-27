const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const levelsDir = path.join(__dirname, 'assets/resources/data/levels');
const files = fs.readdirSync(levelsDir).filter(f => f.endsWith('.json'));

for (const f of files) {
  const metaPath = path.join(levelsDir, f + '.meta');
  if (!fs.existsSync(metaPath)) {
    const uuid = crypto.randomUUID();
    const meta = {
      ver: "2.0.1",
      importer: "json",
      imported: true,
      uuid: uuid,
      files: [".json"],
      subMetas: {},
      userData: {}
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
    console.log(`Created ${f}.meta with uuid=${uuid}`);
  }
}
console.log('Done fixing missing .meta files.');
