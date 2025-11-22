<script>
  import Button from './Button.svelte';

  // Пропсы: открыто ли окно, заголовок, функция закрытия и контент (children)
  let { isOpen, title, onClose, children } = $props();
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onClose}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="header">
        <h3>{title}</h3>
        <button class="close-btn" onclick={onClose}>×</button>
      </div>
      
      <div class="content">
        {@render children()}
      </div>

      <div class="footer">
        <Button onclick={onClose}>Понятно</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 100;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s;
  }

  .modal {
    background: #2d3748;
    color: white;
    width: 90%; max-width: 450px;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    border: 1px solid #4a5568;
    display: flex; flex-direction: column;
    max-height: 90vh;
  }

  .header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px; border-bottom: 1px solid #4a5568;
  }
  h3 { margin: 0; color: #fbd38d; text-transform: uppercase; letter-spacing: 1px; }

  .close-btn {
    background: transparent; border: none; color: #a0aec0; font-size: 24px;
    cursor: pointer; line-height: 1;
  }
  .close-btn:hover { color: white; }

  .content { padding: 20px; overflow-y: auto; text-align: left; line-height: 1.6; }
  
  .footer { padding: 16px; border-top: 1px solid #4a5568; text-align: right; }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
