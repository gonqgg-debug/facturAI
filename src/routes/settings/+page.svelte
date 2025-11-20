<script lang="ts">
  import { apiKey } from '$lib/stores';
  import { db } from '$lib/db';
  import { Save, Download, Upload, Trash2, AlertTriangle } from 'lucide-svelte';

  let keyInput = $apiKey;
  let showSaveSuccess = false;

  function saveKey() {
    apiKey.set(keyInput);
    showSaveSuccess = true;
    setTimeout(() => showSaveSuccess = false, 2000);
  }

  async function backupData() {
    const invoices = await db.invoices.toArray();
    const suppliers = await db.suppliers.toArray();
    const globalContext = await db.globalContext.toArray();
    const kbRules = await db.kbRules.toArray();

    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      invoices,
      suppliers,
      globalContext,
      kbRules
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimarket_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  async function restoreData(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (!confirm('This will OVERWRITE your current data. Are you sure?')) return;

        await db.transaction('rw', db.invoices, db.suppliers, db.globalContext, db.kbRules, async () => {
          await db.invoices.clear();
          await db.suppliers.clear();
          await db.globalContext.clear();
          await db.kbRules.clear();

          if (data.invoices) await db.invoices.bulkAdd(data.invoices);
          if (data.suppliers) await db.suppliers.bulkAdd(data.suppliers);
          if (data.globalContext) await db.globalContext.bulkAdd(data.globalContext);
          if (data.kbRules) await db.kbRules.bulkAdd(data.kbRules);
        });

        alert('Restore successful!');
      } catch (err) {
        alert('Error restoring data: ' + err);
      }
    };

    reader.readAsText(file);
  }

  async function resetData() {
    if (confirm('DANGER: This will delete ALL data permanently. Are you sure?')) {
      if (confirm('Really? There is no going back.')) {
        await db.delete();
        await db.open();
        alert('All data has been reset.');
        window.location.reload();
      }
    }
  }
</script>

<div class="p-4 max-w-2xl mx-auto pb-24">
  <h1 class="text-2xl font-bold text-white mb-6">Settings</h1>

  <!-- API Key Section -->
  <div class="bg-ios-card border border-ios-separator rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold text-white mb-4">AI Configuration</h2>
    <div class="space-y-4">
      <div>
        <label class="block text-sm text-gray-400 mb-1">xAI API Key</label>
        <div class="flex space-x-2">
          <input 
            type="password" 
            bind:value={keyInput} 
            placeholder="xai-..." 
            class="flex-1 bg-black/20 border border-ios-separator rounded-lg px-3 py-2 text-white text-sm"
          />
          <button 
            on:click={saveKey}
            class="bg-ios-blue text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center space-x-2"
          >
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
        {#if showSaveSuccess}
          <p class="text-green-500 text-xs mt-2">API Key saved successfully.</p>
        {/if}
        <p class="text-xs text-gray-500 mt-2">
          Required for invoice extraction. Get one at <a href="https://console.x.ai" target="_blank" class="text-ios-blue underline">console.x.ai</a>.
        </p>
      </div>
    </div>
  </div>

  <!-- Data Management Section -->
  <div class="bg-ios-card border border-ios-separator rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold text-white mb-4">Data Management</h2>
    <div class="space-y-4">
      
      <!-- Backup -->
      <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
        <div>
          <div class="text-white font-medium">Backup Data</div>
          <div class="text-xs text-gray-500">Download a JSON copy of all your data.</div>
        </div>
        <button 
          on:click={backupData}
          class="text-ios-blue hover:bg-ios-blue/10 p-2 rounded-lg transition-colors"
        >
          <Download size={20} />
        </button>
      </div>

      <!-- Restore -->
      <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
        <div>
          <div class="text-white font-medium">Restore Data</div>
          <div class="text-xs text-gray-500">Restore from a JSON backup file.</div>
        </div>
        <label class="text-ios-blue hover:bg-ios-blue/10 p-2 rounded-lg transition-colors cursor-pointer">
          <Upload size={20} />
          <input type="file" accept=".json" on:change={restoreData} class="hidden" />
        </label>
      </div>

      <!-- Reset -->
      <div class="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
        <div>
          <div class="text-red-500 font-medium">Factory Reset</div>
          <div class="text-xs text-red-400/70">Delete all data and reset the app.</div>
        </div>
        <button 
          on:click={resetData}
          class="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
        >
          <AlertTriangle size={20} />
        </button>
      </div>

    </div>
  </div>

  <div class="text-center text-gray-600 text-xs">
    <p>FacturAI PWA v1.1.0</p>
  </div>
</div>
