// ══════════════════════════════════════════════════════
//  FAROFÔMETRO — Servidor Node.js + Socket.io
// ══════════════════════════════════════════════════════
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { maxHttpBufferSize: 10e6 }); // 10 MB (fotos em base64)

const STATE_FILE = path.join(__dirname, 'state.json');
const DEFAULT_STATE = {
  participants: [],
  votes: [],
  messages: [],
  currentDay: 1,
  votingOpen: false,
  adminPin: '783552'
};

// ── Estado em memória ────────────────────────────────
let state = { ...DEFAULT_STATE };

function sanitizeState(raw) {
  const s = { ...DEFAULT_STATE, ...raw };
  if (!Array.isArray(s.participants)) s.participants = [];
  if (!Array.isArray(s.votes))        s.votes = [];
  if (!Array.isArray(s.messages))     s.messages = [];
  if (!s.adminPin)    s.adminPin  = '783552';
  if (!s.currentDay)  s.currentDay = 1;
  return s;
}

// ── Carrega estado salvo ─────────────────────────────
if (fs.existsSync(STATE_FILE)) {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    state = sanitizeState(JSON.parse(raw));
    console.log(`Estado carregado: ${state.participants.length} participante(s), votação ${state.votingOpen ? 'ABERTA' : 'FECHADA'}.`);
  } catch (e) {
    console.error('Erro ao ler state.json:', e.message);
    state = { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Erro ao salvar estado:', e.message);
  }
}

// ── Serve arquivos estáticos ─────────────────────────
app.use(express.static(path.join(__dirname)));

// Rota raiz → index.html
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Socket.io ────────────────────────────────────────
io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  console.log(`[+] Conectado: ${socket.id} (${ip})`);

  // Envia estado atual para o novo cliente
  socket.emit('state:sync', state);

  // Cliente envia atualização de estado
  socket.on('state:push', (newState) => {
    if (!newState || typeof newState !== 'object') return;
    state = sanitizeState(newState);
    saveState();
    // Broadcast para TODOS os outros clientes
    socket.broadcast.emit('state:sync', state);
    console.log(`[~] Estado atualizado: ${state.participants.length} part., votação ${state.votingOpen ? 'ABERTA' : 'FECHADA'}`);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Desconectado: ${socket.id}`);
  });
});

// ── Descobre IPs locais ──────────────────────────────
function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(ifaces)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// ── Inicia o servidor ────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   🌴  FAROFÔMETRO — SERVIDOR INICIADO!  🌴   ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`📍 Seu PC:   http://localhost:${PORT}`);
  console.log(`⚙️  Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`📺 Telão:   http://localhost:${PORT}/telao.html`);

  if (ips.length > 0) {
    console.log('\n📱 LINKS PARA CELULAR (via Wi-Fi / Roteador):');
    ips.forEach(ip => {
      console.log(`\n   🔗 Cadastro:  http://${ip}:${PORT}/cadastro.html`);
      console.log(`   🗳️  Votar:     http://${ip}:${PORT}/votar.html`);
    });
  } else {
    console.log('\n⚠️  Nenhuma rede Wi-Fi detectada no momento.');
    console.log('   Quando conectar, reinicie e o IP aparecerá aqui.');
  }

  console.log('\n✅ Mantenha esta janela aberta durante todo o evento!');
  console.log('   Pressione CTRL+C para encerrar o servidor.\n');
});
