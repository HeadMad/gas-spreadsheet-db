<script>
  let { map, myEmail, onAttack } = $props();

  function getColor(owner) {
    if (!owner) return '#e2e8f0'; // Серый (ничей)
    if (owner === myEmail) return '#48bb78'; // Зеленый (мой)
    
    // Генерируем цвет из имени врага, чтобы он был постоянным
    let hash = 0;
    for (let i = 0; i < owner.length; i++) {
      hash = owner.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }
</script>

<div class="grid-container">
  <div class="grid">
    {#each map as row, y}
      {#each row as cell, x}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="cell" 
          style="background-color: {getColor(cell.owner)}"
          class:my={cell.owner === myEmail}
          onclick={() => onAttack(x, y)}
        >
          {#if cell.power > 0}
            <span class="power">{cell.power}</span>
          {/if}
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .grid-container {
    display: flex; justify-content: center; margin: 20px 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr); /* 10 колонок */
    gap: 4px;
    background: #2d3748;
    padding: 8px;
    border-radius: 8px;
    width: 100%;
    max-width: 400px; /* Ограничение ширины */
    aspect-ratio: 1 / 1;
  }
  .cell {
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: 0.1s;
  }
  .cell:hover { filter: brightness(1.1); transform: scale(1.05); z-index: 10; }
  .cell.my { border: 2px solid white; }
  
  .power {
    font-size: 0.8rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px black;
    pointer-events: none;
  }
</style>
