// ══════════════════════════════════════════════════════
//  FAROFÔMETRO — Sync em Tempo Real via Supabase v3
//  Sincronização robusta: Supabase é a autoridade central.
//  Suporta apagar, adicionar e resetar sem ressuscitar dados.
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

  let _syncLock       = false;
  let _lastServerTs   = 0;
  let _pendingSyncTs  = 0;
  let _syncInProgress = false;

  function markReady() {
    if (window._ffSyncReady) return;
    window._ffSyncReady = true;
    window.dispatchEvent(new Event('ff:syncready'));
    console.log('[Sync] Pronto ✓');
  }

  function getLocalState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) {
      return {};
    }
  }

  function mergeById(a, b) {
    if (!Array.isArray(a)) a = [];
    if (!Array.isArray(b)) b = [];
    const map = new Map();
    [...a, ...b].forEach(function(item) {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  // Aplica o estado recebido do servidor diretamente no localStorage e UI
  function applyState(serverState, ts) {
    if (!serverState || typeof serverState !== 'object') return;
    if (ts) {
      _lastServerTs = ts;
      localStorage.setItem(STORAGE_KEY + '_last_ts', String(ts));
    }

    _syncLock = true;
    try {
      const sanitized = {
        participants: Array.isArray(serverState.participants) ? serverState.participants : [],
        votes:        Array.isArray(serverState.votes) ? serverState.votes : [],
        messages:     Array.isArray(serverState.messages) ? serverState.messages : [],
        currentDay:   serverState.currentDay || 1,
        votingOpen:   !!serverState.votingOpen,
        adminPin:     serverState.adminPin || (window.FF ? window.FF.MASTER_PIN : '783552')
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } finally {
      _syncLock = false;
    }

    if (typeof window.renderAll === 'function') try { window.renderAll(); } catch(e) {}
    if (typeof window.renderS1  === 'function') try { window.renderS1();  } catch(e) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); } catch(e) {}
  }

  // Grava de forma autoritativa no Supabase (para resets, exclusões e adições de participantes)
  async function pushAuthoritative(state) {
    if (!state || typeof state !== 'object') return false;
    _syncInProgress = true;

    const ts  = new Date().toISOString();
    const tsN = new Date(ts).getTime();
    _pendingSyncTs = tsN;

    try {
      const { error } = await sb.from(TABLE).upsert({
        id: 1,
        dados: state,
        atualizado_em: ts
      });

      if (error) {
        console.error('[Sync] Erro ao gravar autoritativo:', error.message);
        _pendingSyncTs = 0;
        return false;
      }

      _lastServerTs  = tsN;
      _pendingSyncTs = 0;

      _syncLock = true;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(STORAGE_KEY + '_last_ts', String(tsN));
      } finally {
        _syncLock = false;
      }

      console.log('[Sync] Gravado com sucesso no Supabase ✓');
      return true;
    } catch(e) {
      console.error('[Sync] Exceção no pushAuthoritative:', e);
      _pendingSyncTs = 0;
      return false;
    } finally {
      _syncInProgress = false;
    }
  }

  // Sincronização padrão (com merge inteligente apenas para votos e mensagens simultâneas)
  async function syncToSupabase(state, isAuthoritative) {
    if (_syncLock) return;
    if (isAuthoritative) {
      return await pushAuthoritative(state);
    }
    if (_syncInProgress) return;
    if (!state || typeof state !== 'object') return;

    _syncInProgress = true;
    const ts  = new Date().toISOString();
    const tsN = new Date(ts).getTime();
    _pendingSyncTs = tsN;

    try {
      // 1. Busca estado atual do servidor
      const { data: serverData } = await sb
        .from(TABLE)
        .select('dados')
        .eq('id', 1)
        .single();

      const serverState = (serverData && serverData.dados) ? serverData.dados : {};

      // 2. Mescla apenas votos e mensagens para evitar corrida de votação
      const merged = {
        ...state,
        votes:    mergeById(serverState.votes || [], state.votes || []),
        messages: mergeById(serverState.messages || [], state.messages || [])
      };

      // 3. Grava no Supabase
      const { error } = await sb.from(TABLE).upsert({
        id: 1,
        dados: merged,
        atualizado_em: ts
      });

      if (error) {
        console.error('[Sync] Erro ao salvar:', error.message);
        _pendingSyncTs = 0;
      } else {
        _lastServerTs  = tsN;
        _pendingSyncTs = 0;
        _syncLock = true;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          localStorage.setItem(STORAGE_KEY + '_last_ts', String(tsN));
        } finally {
          _syncLock = false;
        }
      }
    } catch(e) {
      console.error('[Sync] Erro inesperado no sync:', e);
      _pendingSyncTs = 0;
    } finally {
      _syncInProgress = false;
    }
  }

  // Carrega estado inicial do Supabase
  async function loadState() {
    try {
      const { data, error } = await sb
        .from(TABLE)
        .select('dados, atualizado_em')
        .eq('id', 1)
        .single();

      if (error || !data || !data.dados) {
        console.log('[Sync] Inicializando linha vazia no Supabase...');
        const initial = window.FF ? window.FF.getState() : {
          participants: [], votes: [], messages: [], currentDay: 1, votingOpen: false, adminPin: '783552'
        };
        await pushAuthoritative(initial);
        return;
      }

      const serverState = data.dados;
      const serverTs = data.atualizado_em ? new Date(data.atualizado_em).getTime() : 0;
      _lastServerTs = serverTs;

      // Aplica fielmente o estado do servidor (sem ressuscitar dados locais)
      applyState(serverState, serverTs);
      console.log('[Sync] Estado carregado do Supabase ✓ (' + (serverState.participants || []).length + ' participantes)');
    } catch (e) {
      console.error('[Sync] Erro ao carregar estado:', e);
    } finally {
      markReady();
    }
  }

  // Realtime: recebe atualizações de outros clientes
  sb.channel('ff-realtime-v3')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE },
      function(payload) {
        if (!payload || !payload.new || !payload.new.dados) return;
        const ts = payload.new.atualizado_em ? new Date(payload.new.atualizado_em).getTime() : 0;
        if (ts === _pendingSyncTs) return; // ignora próprio envio
        if (ts > _lastServerTs) {
          applyState(payload.new.dados, ts);
        }
      })
    .subscribe();

  // Polling a cada 5s para garantir sincronização
  setInterval(async function() {
    if (_syncInProgress) return;
    try {
      const { data, error } = await sb
        .from(TABLE).select('dados, atualizado_em').eq('id', 1).single();
      if (error || !data || !data.dados) return;
      const ts = data.atualizado_em ? new Date(data.atualizado_em).getTime() : 0;
      if (ts > _lastServerTs) {
        applyState(data.dados, ts);
      }
    } catch(e) {}
  }, 5000);

  // Ações administrativas e de controle autoritativo expostas globalmente
  window._ffResetParticipants = async function() {
    const s = window.FF.getState();
    s.participants = [];
    s.votes = [];
    return await pushAuthoritative(s);
  };

  window._ffResetVotes = async function() {
    const s = window.FF.getState();
    s.votes = [];
    return await pushAuthoritative(s);
  };

  window._ffResetMessages = async function() {
    const s = window.FF.getState();
    s.messages = [];
    return await pushAuthoritative(s);
  };

  window._ffResetAll = async function() {
    const fresh = {
      participants: [],
      votes: [],
      messages: [],
      currentDay: 1,
      votingOpen: false,
      adminPin: window.FF ? window.FF.MASTER_PIN : '783552'
    };
    return await pushAuthoritative(fresh);
  };

  window._ffRemoveParticipant = async function(id) {
    const s = window.FF.getState();
    s.participants = (s.participants || []).filter(p => p.id !== id);
    s.votes = (s.votes || []).filter(v => v.from !== id && v.to !== id);
    return await pushAuthoritative(s);
  };

  window._ffForceSync = async function() {
    await pushAuthoritative(window.FF.getState());
  };

  // Intercepta as funções do app.js
  if (window.FF) {
    const _origSetState = window.FF.setState;
    window.FF.setState = function(data) {
      const result = _origSetState(data);
      syncToSupabase(data, false);
      return result;
    };

    const AUTH_MUTATORS = ['addParticipant', 'removeParticipant', 'setDay', 'toggleVoting'];
    AUTH_MUTATORS.forEach(function(name) {
      if (typeof window.FF[name] !== 'function') return;
      const _orig = window.FF[name];
      window.FF[name] = function() {
        const result = _orig.apply(this, arguments);
        pushAuthoritative(window.FF.getState());
        return result;
      };
    });

    if (typeof window.FF.submitVotes === 'function') {
      const _origSubmit = window.FF.submitVotes;
      window.FF.submitVotes = function() {
        const result = _origSubmit.apply(this, arguments);
        if (result && result.ok) {
          syncToSupabase(window.FF.getState(), false);
        }
        return result;
      };
    }
  }

  window._ffSb        = sb;
  window._ffSyncReady = false;
  setTimeout(markReady, 3500);

  loadState();
})();
