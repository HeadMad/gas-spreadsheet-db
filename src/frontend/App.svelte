<script>
  import Grid from './components/Grid.svelte';
  import Button from './ui/Button.svelte';
  import Modal from './ui/Modal.svelte'; // <--- Импортируем модалку

  let map = $state([]);
  let myEmail = $state('');
  let lands = $state(0);
  let loading = $state(true);
  let actionLog = $state('Добро пожаловать!');
  
  // Состояние для открытия окна
  let showRules = $state(false); 

  const isDev = typeof google === 'undefined';

  function runGas(fn, ...args) {
    return new Promise((resolve) => {
      if (isDev) {
        setTimeout(() => {
            if (fn === 'getGameState') {
                const m = Array(10).fill(0).map((_, y) => Array(10).fill(0).map((_, x) => ({owner: null, power: 0, x, y})));
                resolve({ map: m, me: 'dev@test.com', stats: {lands: 0} });
            } else {
                resolve({success: true, map: [], message: 'OK'});
            }
        }, 200);
        return;
      }
      google.script.run.withSuccessHandler(resolve)[fn](...args);
    });
  }

  async function refresh() {
    const data = await runGas('getGameState');
    map = data.map;
    myEmail = data.me;
    lands = data.stats.lands;
    loading = false;
  }

  $effect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  });

  async function handleAttack(x, y) {
    actionLog = `Ход на [${x}, ${y}]...`;
    const res = await runGas('attackCell', x, y);
    if (res.success) {
      map = res.map;
      actionLog = res.message;
      refresh();
    } else {
      actionLog = `Ошибка: ${res.error}`;
    }
  }
</script>

<main>
  <header>
    <div class="title-row">
      <h1>🏰 Pixel Kingdom</h1>
      <!-- Кнопка открытия правил -->
      <button class="help-btn" onclick={() => showRules = true}>?</button>
    </div>
    
    <div class="stats">
      <span>Игрок: {myEmail.split('@')[0]}</span>
      <span class="badge">Владения: {lands}</span>
    </div>
  </header>

  {#if loading && map.length === 0}
    <div class="loading">Загрузка мира...</div>
  {:else}
    <Grid {map} {myEmail} onAttack={handleAttack} />
    
    <div class="controls">
      <div class="log">{actionLog}</div>
      <Button onclick={refresh}>🔄 Обновить</Button>
    </div>
  {/if}

  <!-- МОДАЛЬНОЕ ОКНО С ПРАВИЛАМИ -->
  <Modal isOpen={showRules} title="Правила игры" onClose={() => showRules = false}>
    <div class="rules-text">
      <p><strong>Цель игры:</strong> Захватить как можно больше территории.</p>
      
      <h4>🗡️ Атака</h4>
      <p>Кликайте на чужие (серые или цветные) клетки. Если у клетки нет защиты (цифры), она станет вашей.</p>
      <p>Если там есть цифра (например, 5), вам нужно атаковать её 6 раз, чтобы захватить.</p>

      <h4>🛡️ Защита</h4>
      <p>Кликайте на <strong>свои</strong> клетки, чтобы усилить их защиту. Цифра на клетке показывает уровень обороны.</p>

      <h4>⚡ Энергия</h4>
      <p>Каждое действие мгновенно обновляется у всех игроков. Будьте быстрее соперников!</p>
    </div>
  </Modal>
</main>

<style>
  :global(body) { margin: 0; font-family: 'Segoe UI', sans-serif; background: #1a202c; color: white; }
  
  main { max-width: 500px; margin: 0 auto; padding: 20px; text-align: center; }
  
  /* Стили для заголовка с кнопкой */
  .title-row { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 10px; }
  
  h1 { margin: 0; font-size: 1.8rem; color: #fbd38d; text-transform: uppercase; letter-spacing: 2px; }

  .help-btn {
    width: 30px; height: 30px; border-radius: 50%;
    background: #4a5568; color: white; border: 2px solid #a0aec0;
    font-weight: bold; cursor: pointer;
  }
  .help-btn:hover { background: #fbd38d; color: #1a202c; border-color: #fbd38d; }

  .stats { 
    display: flex; justify-content: space-between; background: #2d3748; 
    padding: 10px; border-radius: 8px; font-size: 0.9rem;
  }
  .badge { font-weight: bold; color: #68d391; }

  .loading { padding: 40px; color: #718096; }
  
  .controls { margin-top: 20px; }
  .log { height: 30px; margin-bottom: 10px; color: #a0aec0; font-size: 0.9rem; font-style: italic; }

  /* Стили текста внутри правил */
  .rules-text h4 { margin-bottom: 5px; color: #68d391; margin-top: 15px; }
  .rules-text p { margin-top: 0; margin-bottom: 10px; color: #e2e8f0; }
</style>
