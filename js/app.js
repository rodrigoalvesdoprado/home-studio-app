// =============================================
// APLICAÇÃO PRINCIPAL - CATARSE HOME STUDIO
// =============================================

class CatarseApp {
    constructor() {
        // Estado da aplicação
        this.clients = JSON.parse(localStorage.getItem('studio_clients')) || [];
        this.bookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
        this.auditLog = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
        
        // Inicializar módulos
        this.init();
    }

    async init() {
        try {
            // Inicializar Firebase Sync primeiro
            this.firebaseSync = new FirebaseSync();
            
            // Aguardar sincronização inicial se online
            if (navigator.onLine) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Inicializar gerenciadores
            this.calendar = new CalendarManager(this);
            this.clientsManager = new ClientsManager(this);
            this.bookingsManager = new BookingsManager(this);
            this.reportsManager = new ReportsManager(this);
            this.auditLogManager = new AuditLogManager(this);

            // Configurar eventos globais
            this.setupGlobalEventListeners();
            this.setupMenu();
            
            // NOVO: Botão de instalação PWA
            this.setupPWAInstallButton();

            console.log('✅ Catarse Home Studio inicializado com sucesso!');
            console.log(`📊 ${this.clients.length} clientes | ${this.bookings.length} agendamentos`);

        } catch (error) {
            console.error('❌ Erro na inicialização do app:', error);
        }
    }

    setupGlobalEventListeners() {
        // Sincronização manual
        document.getElementById('manual-sync').addEventListener('click', () => this.forceSync());
        
        // Prevenir envio de formulários com Enter
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                if (target.tagName === 'INPUT' && !target.type === 'submit') {
                    e.preventDefault();
                }
            }
        });

        // NOVO: Fechar modal de duplicatas com o botão X
        document.querySelectorAll('#duplicate-alert-modal .close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('duplicate-alert-modal').classList.remove('active');
                if (this.clientsManager) {
                    this.clientsManager.pendingClientData = null;
                    this.clientsManager.duplicateResults = null;
                }
            });
        });

        // NOVO: Fechar modal de duplicatas clicando fora
        document.getElementById('duplicate-alert-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('duplicate-alert-modal')) {
                document.getElementById('duplicate-alert-modal').classList.remove('active');
                if (this.clientsManager) {
                    this.clientsManager.pendingClientData = null;
                    this.clientsManager.duplicateResults = null;
                }
            }
        });

        // NOVO: Detectar se app está rodando como PWA
        this.setupPWAFeatures();
    }

    // NOVO: Botão de instalação PWA
    setupPWAInstallButton() {
        // Cria o botão de instalação
        const installButton = document.createElement('button');
        installButton.id = 'pwa-install-btn';
        installButton.className = 'btn btn-info';
        installButton.innerHTML = '📱 Instalar App';
        installButton.style.display = 'none';
        
        // Adiciona ao header do calendário
        const calendarNav = document.querySelector('.calendar-nav');
        if (calendarNav) {
            calendarNav.appendChild(installButton);
        }

        // Detecta evento de instalação
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installButton.style.display = 'inline-flex';
            
            installButton.onclick = () => {
                installButton.style.display = 'none';
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('✅ Usuário aceitou instalação');
                        this.showClientAlert('App instalado com sucesso!', 'success');
                    } else {
                        console.log('❌ Usuário recusou instalação');
                    }
                    deferredPrompt = null;
                });
            };
        });

        // Esconde botão se já estiver instalado
        window.addEventListener('appinstalled', () => {
            installButton.style.display = 'none';
            deferredPrompt = null;
            console.log('📱 App instalado com sucesso!');
            this.showClientAlert('App instalado com sucesso!', 'success');
        });

        // Esconde botão se não for compatível
        if (!this.canShowInstallPrompt()) {
            installButton.style.display = 'none';
        }
    }

    // NOVO: Configura recursos específicos do PWA
    setupPWAFeatures() {
        // Verifica se está rodando como app instalado
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone === true;

        if (isPWA) {
            console.log('🚀 Executando como PWA instalado');
            document.body.classList.add('pwa-mode');
            
            // Comportamentos específicos para PWA
            this.showClientAlert('Modo app ativado!', 'info');
        } else {
            console.log('🌐 Executando no navegador');
            
            // Mostra dica de instalação após algum tempo de uso
            setTimeout(() => {
                this.showPWAInstallPrompt();
            }, 30000); // 30 segundos
        }

        // Monitora mudanças na conexão para PWA
        window.addEventListener('online', () => {
            console.log('📡 Conexão restaurada - Sincronizando...');
            this.showClientAlert('Conexão restaurada! Sincronizando...', 'success');
            this.forceSync();
        });

        window.addEventListener('offline', () => {
            console.log('🔴 Modo offline ativado');
            this.showClientAlert('Modo offline ativado', 'warning');
        });
    }

    // NOVO: Mostra alerta temporário
    showClientAlert(message, type) {
        // Cria alerta temporário se não existir
        let alertElement = document.getElementById('global-alert');
        if (!alertElement) {
            alertElement = document.createElement('div');
            alertElement.id = 'global-alert';
            alertElement.style.cssText = `
                position: fixed;
                top: 70px;
                right: 20px;
                z-index: 2000;
                min-width: 250px;
                max-width: 400px;
            `;
            document.body.appendChild(alertElement);
        }
        
        alertElement.innerHTML = `
            <div class="alert alert-${type}">
                ${message}
            </div>
        `;
        
        setTimeout(() => {
            if (alertElement) {
                alertElement.remove();
            }
        }, 4000);
    }

    // NOVO: Sugere instalação do PWA
    showPWAInstallPrompt() {
        // Só mostra se for compatível com instalação
        if (this.canShowInstallPrompt() && !this.hasSeenInstallPrompt()) {
            console.log('💡 Sugerindo instalação do app...');
            this.showClientAlert('💡 Dica: Instale este app para melhor experiência!', 'info');
            localStorage.setItem('pwa_install_prompt_seen', 'true');
        }
    }

    // NOVO: Verifica se pode mostrar prompt de instalação
    canShowInstallPrompt() {
        return 'serviceWorker' in navigator && 
               'BeforeInstallPromptEvent' in window;
    }

    // NOVO: Verifica se usuário já viu o prompt
    hasSeenInstallPrompt() {
        return localStorage.getItem('pwa_install_prompt_seen') === 'true';
    }

    setupMenu() {
        // Menu mobile toggle
        document.querySelector('.mobile-menu-btn').addEventListener('click', function() {
            const menuContent = document.querySelector('.mobile-menu-content');
            menuContent.classList.toggle('active');
        });
        
        // Fechar menu mobile ao clicar em um link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.querySelector('.mobile-menu-content').classList.remove('active');
            });
        });

        // Navegação entre páginas
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });
    }

    handleNavigation(e) {
        e.preventDefault();
        const pageId = e.target.getAttribute('data-page');
        this.showPage(pageId);
    }

    showPage(pageId) {
        // Esconder todas as páginas
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Mostrar página selecionada
        document.getElementById(pageId).classList.add('active');

        // Atualizar navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        event.target.classList.add('active');

        // Carregar dados específicos da página
        this.loadPageData(pageId);
    }

    loadPageData(pageId) {
        switch(pageId) {
            case 'clients':
                this.clientsManager.renderClientsList();
                this.clientsManager.updateClientStats();
                break;
            case 'bookings':
                this.bookingsManager.renderBookingsList();
                break;
            case 'reports':
                this.reportsManager.generateReport();
                break;
            case 'audit':
                this.auditLogManager.renderAuditLog();
                this.auditLogManager.updateLogStats();
                break;
        }
    }

    // =============================================
    // MÉTODOS PÚBLICOS PARA OS MÓDULOS
    // =============================================

    // Métodos para ClientsManager
    editClient(clientId) {
        this.clientsManager.editClient(clientId);
    }

    deleteClient(clientId) {
        this.clientsManager.deleteClient(clientId);
    }

    // Métodos para BookingsManager  
    openBookingModal(date, startTime, bookingId = null) {
        this.bookingsManager.openBookingModal(date, startTime, bookingId);
    }

    viewBookingDetails(bookingId) {
        this.bookingsManager.viewBookingDetails(bookingId);
    }

    saveCompletedActivities(bookingId) {
        this.bookingsManager.saveCompletedActivities(bookingId);
    }

    // Métodos para AuditLogManager
    logAction(action, entity, entityId, details = {}) {
        this.auditLogManager.logAction(action, entity, entityId, details);
    }

    // =============================================
    // MÉTODOS DE UTILIDADE GLOBAL
    // =============================================

    async forceSync() {
        try {
            await this.firebaseSync.syncData();
            // Atualizar dados locais após sync
            this.clients = JSON.parse(localStorage.getItem('studio_clients')) || [];
            this.bookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
            
            // Atualizar visualizações
            this.calendar.refresh();
            this.clientsManager.renderClientsList();
            this.clientsManager.updateClientStats();
            this.bookingsManager.renderBookingsList();
            
            this.showClientAlert('Sincronização concluída com sucesso!', 'success');
        } catch (error) {
            console.error('Erro na sincronização:', error);
            this.showClientAlert('Erro na sincronização. Verifique sua conexão.', 'error');
        }
    }

    exportData() {
        const data = {
            clients: this.clients,
            bookings: this.bookings,
            auditLog: this.auditLog,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_catarse_studio_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.clients && data.bookings) {
                    if (confirm('Isso substituirá todos os dados atuais. Continuar?')) {
                        this.clients = data.clients;
                        this.bookings = data.bookings;
                        this.auditLog = data.auditLog || [];
                        
                        localStorage.setItem('studio_clients', JSON.stringify(this.clients));
                        localStorage.setItem('studio_bookings', JSON.stringify(this.bookings));
                        localStorage.setItem('studio_audit_log', JSON.stringify(this.auditLog));
                        
                        // Sincronizar com Firebase
                        this.clients.forEach(client => this.firebaseSync.saveClient(client));
                        this.bookings.forEach(booking => this.firebaseSync.saveBooking(booking));
                        this.auditLog.forEach(log => this.firebaseSync.saveAuditLog(log));
                        
                        // Atualizar todas as visualizações
                        this.calendar.refresh();
                        this.clientsManager.renderClientsList();
                        this.clientsManager.updateClientStats();
                        this.bookingsManager.renderBookingsList();
                        this.auditLogManager.renderAuditLog();
                        this.auditLogManager.updateLogStats();
                        
                        this.showClientAlert('Dados importados com sucesso!', 'success');
                    }
                } else {
                    this.showClientAlert('Arquivo de backup inválido.', 'error');
                }
            } catch (error) {
                this.showClientAlert('Erro ao importar dados: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    // =============================================
    // GETTERS PARA OS MÓDULOS
    // =============================================

    getClients() {
        return this.clients;
    }

    getBookings() {
        return this.bookings;
    }

    getAuditLog() {
        return this.auditLog;
    }
}

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================

let app;

document.addEventListener('DOMContentLoaded', function() {
    try {
        app = new CatarseApp();
        
        // Tornar app global para funções inline no HTML
        window.app = app;
        
        // Função global para sync manual
        window.forceSync = function() {
            app.forceSync();
        };
        
        console.log('🎵 Catarse Home Studio está pronto!');
        
    } catch (error) {
        console.error('💥 Erro fatal na inicialização:', error);
        alert('Erro ao inicializar o sistema. Recarregue a página.');
    }
});

// Service Worker para funcionalidade offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker registrado com sucesso:', registration.scope);
            })
            .catch(function(error) {
                console.log('❌ Service Worker falhou:', error);
            });
    });
}
