<script>
  let { onclick, disabled = false, children } = $props();
</script>

<button {onclick} {disabled}>
  {@render children()}
</button>

<style>
  button {
    background: #2d3748; color: white;
    border: 2px solid #4a5568;
    padding: 8px 16px;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    cursor: pointer;
    border-radius: 4px;
    box-shadow: 0 4px 0 #1a202c;
    transition: transform 0.1s;
  }
  button:active {
    transform: translateY(4px);
    box-shadow: 0 0 0 #1a202c;
  }
  button:disabled { opacity: 0.5; cursor: wait; }
</style>
