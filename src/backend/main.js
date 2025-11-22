// Инициализация БД (если нет)
function getDB() {
  const props = PropertiesService.getScriptProperties();
  let mapData = props.getProperty('GAME_MAP');
  
  if (!mapData) {
    // Создаем пустую карту 10x10
    const map = [];
    for (let y = 0; y < 10; y++) {
      const row = [];
      for (let x = 0; x < 10; x++) {
        row.push({ owner: null, power: 0, x, y });
      }
      map.push(row);
    }
    mapData = JSON.stringify(map);
    props.setProperty('GAME_MAP', mapData);
  }
  
  return JSON.parse(mapData);
}

function saveDB(map) {
  PropertiesService.getScriptProperties().setProperty('GAME_MAP', JSON.stringify(map));
}

// --- API ---

export function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Pixel Kingdom ⚔️')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
}

// Получить состояние игры
export function getGameState() {
  const userEmail = Session.getActiveUser().getEmail() || 'Anon_' + Math.floor(Math.random() * 1000);
  const map = getDB();
  
  // Считаем владения игрока
  let lands = 0;
  map.forEach(row => row.forEach(cell => {
    if (cell.owner === userEmail) lands++;
  }));

  return {
    map: map,
    me: userEmail,
    stats: { lands: lands, energy: 10 } // Упростим: энергия пока бесконечная или 10 на ход
  };
}

// Атака клетки
export function attackCell(x, y) {
  // Блокировка (Lock), чтобы два игрока не ударили одновременно
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return { success: false, error: 'Server busy' };

  try {
    const userEmail = Session.getActiveUser().getEmail() || 'Anon';
    const map = getDB();
    
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return { error: 'Invalid coords' };

    const target = map[y][x];

    // Логика боя
    if (target.owner === userEmail) {
      // Укрепляем свою землю
      target.power += 1;
    } else {
      // Атакуем чужую
      if (target.power > 0) {
        target.power -= 1; // Снимаем защиту
      } else {
        // Захват!
        target.owner = userEmail;
        target.power = 1;
      }
    }

    saveDB(map);
    
    return { 
      success: true, 
      map: map, // Возвращаем обновленную карту
      message: target.owner === userEmail ? 'Захвачено!' : 'Атака успешна!' 
    };

  } catch (e) {
    return { error: e.message };
  } finally {
    lock.releaseLock();
  }
}
