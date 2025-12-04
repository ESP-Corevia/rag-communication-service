const io = require('socket.io-client');

const socket = io('http://localhost:4000');

socket.on('connect', () => {
  console.log('✅ Connecté au serveur\n');

  // Change la query ici pour tester différentes choses
  socket.emit('query', {
    type: 'query',
    agent: 'medecin_generaliste',
    query: 'Jai un object coincé dans les FetchResponseToJSON, que faire ??',
    userId: 'test-user'
  });
});

socket.on('message', (data) => {
  if (data.type === 'chunk') {
    // Affiche le streaming token par token
    process.stdout.write(data.content);
  } else if (data.type === 'done') {
    console.log('\n\n✅ Réponse terminée');
    process.exit(0);
  } else if (data.type === 'error') {
    console.error('\n❌ Erreur:', data.message);
    process.exit(1);
  }
});

socket.on('disconnect', () => {
  console.log('\n⚠️  Déconnecté du serveur');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
  console.error('\nVérifie que le serveur tourne: npm run dev');
  process.exit(1);
});
