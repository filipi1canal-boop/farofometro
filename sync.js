// ══════════════════════════════════════════════════════
//  FAROFÔMETRO — Sync em Tempo Real via Supabase v2
//  MERGE-FIRST: votos e mensagens são UNIDOS, nunca
//  sobrescritos. Corrige perda de dados em votações
//  simultâneas (race condition last-write-wins).
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  if (typeof window.supabase === 'undefined') {
    console.warn('[Sync] Supabase não disponível. Modo offline.');
    window._ffSyncReady = true;
    window.dispatchEvent(new Event('ff:syncready'));
    return;
  }

  const SUPABASE_URL = 'https://bezxxswumircpkdijbou.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlenh4c3d1bWlyY3BrZGlqYm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODkxNjIsImV4cCI6MjA5MDM2NTE2Mn0.Qof3plUdiw9O_b2_yZFkk_kWW4fvoEIYLLk9w72HZKI';
  const TABLE       = 'farofometro_estado';
  const STORAGE_KEY = 'farofometro_v4';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let _syncLock      = false;
  let _lastServerTs  = 0;
  let _pendingSyncTs = 0;
  let _mutationCount = 0;
  let _syncInProgress = false; // previne chamadas paralelas ao syncToSupabase

  // ── Marca sync como pronto para as páginas ───────────
  function markReady() {
    if (window._ffSyncReady) return;
    window._ffSyncReady = true;
    window.dispatchEvent(new Event('ff:syncready'));
    console.log('[Sync] Pronto ✓');
  }

  // ── Merge de arrays por ID (UNION sem duplicatas) ────
  // Garante que nenhum voto ou mensagem seja perdido
  // quando dois dispositivos sincronizam ao mesmo tempo.
  function mergeById(a, b) {
    if (!Array.isArray(a)) a = [];
    if (!Array.isArray(b)) b = [];
    const map = new Map();
    // 'a' primeiro, 'b' por cima — b vence em conflito de mesmo id
    [...a, ...b].forEach(function(item) {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  // ── Lê estado local com segurança ────────────────────
  function getLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) {
      return {};
    }
  }

  // ── Atualiza localStorage e UI com estado mesclado ───
  function applyState(serverState, ts) {
    if (!serverState || typeof serverState !== 'object') return;
    if (ts) _lastServerTs = ts;

    _syncLock = true;
    let needsResync = false;
    try {
      const localState = getLocalState();

      // MERGE: votos e mensagens são UNIDOS (local + servidor)
      // Tudo mais (participantes, dia, votingOpen) vem do servidor
      const mergedVotes = mergeById(localState.votes    || [], serverState.votes    || []);
      const mergedMsgs  = mergeById(localState.messages || [], serverState.messages || []);

      // Se tínhamos dados locais que o servidor não tem → precisamos re-sincronizar
      if (mergedVotes.length > (serverState.votes    || []).length ||
          mergedMsgs.length  > (serverState.messages || []).length) {
        needsResync = true;
        console.log('[Sync] Dados locais mais completos que o servidor — re-sincronizando...');
      }

      const merged = {
        ...serverState,
        votes:    mergedVotes,
        messages: mergedMsgs
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      if (ts) localStorage.setItem(STORAGE_KEY + '_last_ts', String(ts));
    } finally {
      _syncLock = false;
    }

    if (typeof window.renderAll === 'function') try { window.renderAll(); } catch(e) {}
    if (typeof window.renderS1  === 'function') try { window.renderS1();  } catch(e) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); } catch(e) {}

    // Re-sobe o estado mesclado ao servidor para que todos recebam
    if (needsResync) {
      setTimeout(function() { syncToSupabase(window.FF.getState()); }, 800);
    }
  }

  // ── Envia estado ao Supabase com READ-MODIFY-WRITE ───
  // Busca o estado atual do servidor, mescla votos/mensagens
  // e só então grava — evitando sobrescrever dados de outros.
  async function syncToSupabase(state) {
    if (_syncLock)       return;
    if (_syncInProgress) return; // evita chamadas paralelas que causariam conflito
    if (!state || typeof state !== 'object') return;

    _syncInProgress = true;
    _mutationCount++;

    const ts  = new Date().toISOString();
    const tsN = new Date(ts).getTime();
    _pendingSyncTs = tsN;

    try {
      // 1. Busca estado atual do servidor para fazer merge
      const { data: serverData } = await sb
        .from(TABLE)
        .select('dados')
        .eq('id', 1)
        .single();

      const serverState = (serverData && serverData.dados) ? serverData.dados : {};

      // 2. Mescla: estado local vence em participantes/dia/votingOpen;
      //    votos e mensagens são UNIDOS para não perder nada
      const merged = {
        ...state,
        votes:    mergeById(serverState.votes    || [], state.votes    || []),
        messages: mergeById(serverState.messages || [], state.messages || [])
      };

      // 3. Grava estado mesclado no Supabase
      const { error } = await sb.from(TABLE)
        .upsert({ id: 1, dados: merged, atualizado_em: ts });

      if (error) {
        console.error('[Sync] Erro ao salvar:', error.message);
        _pendingSyncTs = 0;
      } else {
        _lastServerTs  = tsN;
        _pendingSyncTs = 0;
        // Atualiza localStorage com o estado já mesclado
        _syncLock = true;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } finally { _syncLock = false; }
        localStorage.setItem(STORAGE_KEY + '_last_ts', String(tsN));
        console.log('[Sync] Salvo no Supabase ✓ (' +
          (merged.votes    || []).length + ' votos, ' +
          (merged.messages || []).length + ' msgs)');
      }
    } catch(e) {
      console.error('[Sync] Erro inesperado no sync:', e);
      _pendingSyncTs = 0;
    } finally {
      _syncInProgress = false;
    }
  }

  // ── Carrega estado inicial do Supabase ───────────────
  async function loadState() {
    const mutationSnapshot = _mutationCount;
    try {
      const { data, error } = await sb
        .from(TABLE)
        .select('dados, atualizado_em')
        .eq('id', 1)
        .single();

      if (error || !data) {
        // Linha ainda não existe: cria com estado local
        const localState = window.FF.getState();
        await sb.from(TABLE).upsert({
          id: 1, dados: localState,
          atualizado_em: new Date().toISOString()
        });
        console.log('[Sync] Linha criada no Supabase.');
        return;
      }

      // Se houve mutação durante o fetch → não sobrescreve
      if (_mutationCount !== mutationSnapshot) {
        console.log('[Sync] loadState ignorado — mutação local durante o fetch.');
        return;
      }

      const serverState = data.dados;
      const serverTs    = data.atualizado_em
        ? new Date(data.atualizado_em).getTime() : 0;
      _lastServerTs = serverTs;
      localStorage.setItem(STORAGE_KEY + '_last_ts', String(serverTs));

      // Servidor vazio mas local tem dados → migra local para servidor
      if (!serverState || !serverState.participants || serverState.participants.length === 0) {
        const localState = window.FF.getState();
        if (Array.isArray(localState.participants) && localState.participants.length > 0) {
          console.log('[Sync] Migrando dados locais para o Supabase...');
          await sb.from(TABLE).upsert({
            id: 1, dados: localState,
            atualizado_em: new Date().toISOString()
          });
          return;
        }
      }

      // Aplica com merge (garante que votos locais não sejam perdidos)
      applyState(serverState, serverTs);
      console.log('[Sync] Estado carregado do Supabase ✓');
    } catch (e) {
      console.error('[Sync] Erro ao carregar estado:', e);
    } finally {
      markReady();
    }
  }

  // ── Realtime: recebe mudanças de outros dispositivos ─
  sb.channel('ff-realtime-v2') // Canal novo para evitar conflito com subscriptions antigas
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE },
      function(payload) {
        console.log('[Sync] Atualização em tempo real recebida!');
        const ts = payload.new.atualizado_em
          ? new Date(payload.new.atualizado_em).getTime() : 0;
        // Ignora bounce-back da nossa própria escrita ainda pendente
        if (ts === _pendingSyncTs) {
          console.log('[Sync] Realtime ignorado — bounce-back do próprio device.');
          return;
        }
        // Aplica se for mais recente (merge preserva votos locais)
        if (ts > _lastServerTs) applyState(payload.new.dados, ts);
      })
    .subscribe(function(status) { console.log('[Sync] Realtime status:', status); });

  // ── Polling a cada 5s (mais frequente para recuperar votos perdidos) ─
  setInterval(async function() {
    if (_syncInProgress) return;
    try {
      const { data, error } = await sb
        .from(TABLE).select('dados, atualizado_em').eq('id', 1).single();
      if (error || !data) return;
      const ts = data.atualizado_em
        ? new Date(data.atualizado_em).getTime() : 0;
      if (ts > _lastServerTs) {
        console.log('[Sync] Polling detectou novidade, aplicando...');
        applyState(data.dados, ts);
      }
    } catch(e) { /* ignora */ }
  }, 5000);

  // ── Intercepta as funções que mutam o estado ─────────
  if (window.FF) {
    // 1. FF.setState direto (resets do admin)
    const _origSetState = window.FF.setState;
    window.FF.setState = function(data) {
      const result = _origSetState(data);
      syncToSupabase(data);
      return result;
    };

    // 2. Funções de mutação que chamam setState internamente
    const MUTATORS = [
      'addParticipant',
      'removeParticipant',
      'submitVotes',
      'setDay',
      'toggleVoting'
    ];

    MUTATORS.forEach(function(name) {
      if (typeof window.FF[name] !== 'function') return;
      const _orig = window.FF[name];
      window.FF[name] = function() {
        const result = _orig.apply(this, arguments);
        syncToSupabase(window.FF.getState());
        return result;
      };
    });
  }

  // ── API pública para forçar re-sync manual ───────────
  // Uso: window._ffForceSync() no console ou pelo admin
  window._ffForceSync = async function() {
    console.log('[Sync] Force-sync iniciado...');
    await syncToSupabase(window.FF.getState());
    console.log('[Sync] Force-sync concluído.');
  };

  // Expõe cliente para debug
  window._ffSb         = sb;
  window._ffSyncReady  = false;

  // Fallback de segurança: libera a página após 3.5s mesmo se Supabase demorar
  setTimeout(markReady, 3500);

  // Inicia carregando o estado do servidor
  loadState();
})();
