// =============================================
// APLICAÇÃO PRINCIPAL - CATARSE HOME STUDIO
// =============================================

class CatarseApp {
    constructor() {
        // Estado da aplicação
        this.clients = JSON.parse(localStorage.getItem('studio_clients')) || [];
        this.bookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
        this.auditLog = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
        
        // Controle de instalação PWA
        this.deferredPrompt = null;
        this.installButton = null;
        
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
            
            // Sistema de instalação PWA
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

        // Fechar modal de duplicatas com o botão X
        document.querySelectorAll('#duplicate-alert-modal .close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('duplicate-alert-modal').classList.remove('active');
                if (this.clientsManager) {
                    this.clientsManager.pendingClientData = null;
                    this.clientsManager.duplicateResults = null;
                }
            });
        });

        // Fechar modal de duplicatas clicando fora
        document.getElementById('duplicate-alert-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('duplicate-alert-modal')) {
                document.getElementById('duplicate-alert-modal').classList.remove('active');
                if (this.clientsManager) {
                    this.clientsManager.pendingClientData = null;
                    this.clientsManager.duplicateResults = null;
                }
            }
        });

        // Detectar se app está rodando como PWA
        this.setupPWAFeatures();
    }

    // SISTEMA COMPLETO DE INSTALAÇÃO PWA
    setupPWAInstallButton() {
        // Remove botão anterior se existir
        const oldBtn = document.getElementById('pwa-install-btn');
        if (oldBtn) oldBtn.remove();

        // Cria o botão de instalação
        this.installButton = document.createElement('button');
        this.installButton.id = 'pwa-install-btn';
        this.installButton.className = 'btn btn-info';
        this.installButton.innerHTML = '📱 Instalar App';
        this.installButton.style.display = 'none';
        
        // Adiciona ao header do calendário
        const calendarNav = document.querySelector('.calendar-nav');
        if (calendarNav) {
            calendarNav.appendChild(this.installButton);
        }

        // Evento quando o PWA pode ser instalado
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA pode ser instalado');
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Mostra o botão de instalação
            this.showInstallButton();
            
            // Se usuário não instalou após 30 segundos, mostra dica
            setTimeout(() => {
                if (this.deferredPrompt && !this.isAppInstalled()) {
                    this.showInstallPrompt();
                }
            }, 30000);
        });

        // Evento quando usuário instala o app
        window.addEventListener('appinstalled', () => {
            console.log('✅ App instalado com sucesso!');
            this.hideInstallButton();
            this.deferredPrompt = null;
            this.showClientAlert('App instalado com sucesso!', 'success');
        });

        // Configura o clique do botão
        this.installButton.addEventListener('click', () => {
            this.installPWA();
        });

        // Verifica se já está instalado
        if (this.isAppInstalled()) {
            this.hideInstallButton();
        }
    }

    // Mostra botão de instalação
    showInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'inline-flex';
            this.installButton.style.animation = 'pulse-gentle 2s infinite';
        }
    }

    // Esconde botão de instalação
    hideInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'none';
            this.installButton.style.animation = 'none';
        }
    }

    // Instala o PWA
    async installPWA() {
        if (!this.deferredPrompt) {
            this.showClientAlert('O app já está instalado ou não pode ser instalado neste dispositivo.', 'info');
            return;
        }

        try {
            this.installButton.innerHTML = '⏳ Instalando...';
            this.installButton.disabled = true;
            
            // Mostra o prompt de instalação
            this.deferredPrompt.prompt();
            
            // Aguarda a decisão do usuário
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('✅ Usuário aceitou a instalação');
                this.showClientAlert('App instalado com sucesso!', 'success');
            } else {
                console.log('❌ Usuário recusou a instalação');
                this.showClientAlert('Instalação cancelada. Você pode instalar depois pelo botão "📱 Instalar App".', 'info');
            }
            
            this.deferredPrompt = null;
            
        } catch (error) {
            console.error('❌ Erro na instalação:', error);
            this.showClientAlert('Erro na instalação. Tente novamente.', 'error');
        } finally {
            this.installButton.innerHTML = '📱 Instalar App';
            this.installButton.disabled = false;
        }
    }

    // Verifica se o app já está instalado
    isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true ||
               document.referrer.includes('android-app://');
    }

    // Mostra dica de instalação
    showInstallPrompt() {
        if (this.deferredPrompt && !this.isAppInstalled()) {
            const shouldShow = confirm(
                '💡 **Dica do Catarse Studio**\n\n' +
                'Gostaria de instalar o app para melhor experiência?\n\n' +
                '✅ Funciona offline\n' +
                '✅ Mais rápido\n' +
                '✅ Acesso direto da tela inicial\n\n' +
                'Clique em "Instalar App" no topo da página!'
            );
            
            if (shouldShow) {
                localStorage.setItem('pwa_install_prompt_seen', 'true');
            }
        }
    }

    // Configura recursos específicos do PWA
    setupPWAFeatures() {
        const isPWA = this.isAppInstalled();

        if (isPWA) {
            console.log('🚀 Executando como PWA instalado');
            document.body.classList.add('pwa-mode');
            this.showClientAlert('Modo app ativado!', 'info', 3000);
        } else {
            console.log('🌐 Executando no navegador');
        }

        // Monitora mudanças na conexão
        window.addEventListener('online', () => {
            console.log('📡 Conexão restaurada - Sincronizando...');
            this.showClientAlert('Conexão restaurada! Sincronizando...', 'success', 3000);
            this.forceSync();
        });

        window.addEventListener('offline', () => {
            console.log('🔴 Modo offline ativado');
            this.showClientAlert('Modo offline ativado', 'warning', 3000);
        });
    }

    // Mostra alerta temporário
    showClientAlert(message, type, duration = 4000) {
        // Remove alerta anterior se existir
        let alertElement = document.getElementById('global-alert');
        if (alertElement) {
            alertElement.remove();
        }

        // Cria novo alerta
        alertElement = document.createElement('div');
        alertElement.id = 'global-alert';
        alertElement.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 2000;
            min-width: 250px;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        alertElement.innerHTML = `
            <div class="alert alert-${type}">
                ${message}
            </div>
        `;
        
        document.body.appendChild(alertElement);
        
        // Remove após o tempo especificado
        setTimeout(() => {
            if (alertElement && alertElement.parentNode) {
                alertElement.remove();
            }
        }, duration);
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
        
        // Ativar link correspondente
        document.querySelectorAll(`.nav-link[data-page="${pageId}"]`).forEach(link => {
            link.classList.add('active');
        });

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
