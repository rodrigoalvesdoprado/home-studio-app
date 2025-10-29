// =============================================
// SERVICE WORKER - CATARSE HOME STUDIO PWA
// =============================================

const CACHE_NAME = 'catarse-studio-v1.2.1';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/firebase-sync.js',
  './js/calendar.js',
  './js/clients.js', 
  './js/bookings.js',
  './js/reports.js',
  './js/audit-log.js',
  './js/app.js',
  './assets/sua-logo-20-p-cento.png',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js'
];

// Instalação - Cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache aberto, adicionando arquivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos os arquivos em cache!');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erro no cache:', error);
      })
  );
});

// Ativação - Limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker ativado!');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache limpo!');
      return self.clients.claim();
    })
  );
});

// Intercepta requisições - Estratégia Cache First
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Firebase (são online-first)
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retorna do cache se encontrou
        if (response) {
          return response;
        }

        // Se não tem no cache, busca na rede
        return fetch(event.request)
          .then((networkResponse) => {
            // Se a requisição foi bem sucedida, adiciona ao cache
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback para páginas - retorna a página inicial
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            // Fallback para outros recursos
            return new Response('🔴 Modo offline - Sem conexão', {
              status: 408,
              statusText: 'Offline'
            });
          });
      })
  );
});

// Mensagens do app principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Sincronização em background (quando online novamente)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Sincronização em background...');
    event.waitUntil(
      // Aqui você pode adicionar lógica de sincronização
      // quando o app voltar a ficar online
      Promise.resolve()
    );
  }
});

console.log('🎵 Service Worker do Catarse Studio carregado!');
