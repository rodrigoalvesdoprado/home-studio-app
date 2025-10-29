// =============================================
// SERVICE WORKER - CATARSE HOME STUDIO PWA
// =============================================

const CACHE_NAME = 'catarse-studio-v1.3.0';
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
  './manifest.json',
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
        // FORÇA ATIVAÇÃO IMEDIATA - IMPORTANTE PARA PWA
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erro no cache:', error);
      })
  );
});

// Ativação - Limpa caches antigos e assume controle imediato
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
      // ASSUME CONTROLE IMEDIATO DE TODAS AS GUIA - ESSENCIAL PARA PWA
      return self.clients.claim();
    })
  );
});

// Intercepta requisições - Estratégia Cache First com fallback
self.addEventListener('fetch', (event) => {
  // Ignora requisições do Firebase (são online-first)
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('brasilapi')) {
    return;
  }

  // Ignora requisições POST (formulários)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retorna do cache se encontrou
        if (response) {
          console.log('📂 Servindo do cache:', event.request.url);
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
                  console.log('💾 Adicionando ao cache:', event.request.url);
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('🔴 Offline - Fallback para:', event.request.url);
            
            // Fallback para páginas - retorna a página inicial
            if (event.request.destination === 'document' || 
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // Fallback para CSS
            if (event.request.url.includes('.css')) {
              return caches.match('./css/styles.css');
            }
            
            // Fallback genérico
            return new Response('🔴 Catarse Studio - Modo Offline\n\nSua conexão está indisponível no momento. Algumas funcionalidades podem não estar disponíveis.', {
              status: 408,
              statusText: 'Offline',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// Mensagens do app principal
self.addEventListener('message', (event) => {
  console.log('📨 Mensagem recebida no Service Worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏩ Pulando espera...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: '1.3.0',
      cacheName: CACHE_NAME
    });
  }
});

// Sincronização em background (quando online novamente)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Sincronização em background iniciada...');
    event.waitUntil(
      // Aqui você pode adicionar lógica de sincronização
      // quando o app voltar a ficar online
      new Promise((resolve) => {
        console.log('✅ Sincronização em background concluída');
        resolve();
      })
    );
  }
});

// Notificações push (para futuras implementações)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Novo agendamento no Catarse Studio',
    icon: './assets/sua-logo-20-p-cento.png',
    badge: './assets/sua-logo-20-p-cento.png',
    tag: 'catarse-notification',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Catarse Studio', options)
  );
});

// Clique em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({type: 'window'}).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
    );
  }
});

console.log('🎵 Service Worker do Catarse Studio carregado e pronto!');
