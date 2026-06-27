const fs = require('fs');
const path = require('path');

const levelsDir = path.join(__dirname, 'assets/resources/data/levels');

function adjustTraySlots(levelId) {
  const filePath = path.join(levelsDir, `level_${String(levelId).padStart(3,'0')}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const layers = data.board.maxLayers || 1;
  const groups = [...new Set(data.tiles.map(t => t.groupId))].length;

  let slots = 8;
  if (layers >= 2) slots -= 1;
  if (layers >= 3) slots -= 1;
  if (groups >= 7) slots -= 1;
  if (slots < 5) slots = 5;

  data.tray.maxSlots = slots;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Level ${levelId}: layers=${layers}, groups=${groups} -> maxSlots=${slots}`);
}

for (let i = 3; i <= 10; i++) {
  adjustTraySlots(i);
}
