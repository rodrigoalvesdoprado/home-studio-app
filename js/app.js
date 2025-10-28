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
            
            alert('Sincronização concluída com sucesso!');
        } catch (error) {
            console.error('Erro na sincronização:', error);
            alert('Erro na sincronização. Verifique sua conexão.');
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
                        
                        alert('Dados importados com sucesso!');
                    }
                } else {
                    alert('Arquivo de backup inválido.');
                }
            } catch (error) {
                alert('Erro ao importar dados: ' + error.message);
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

// Service Worker para funcionalidade offline (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registrado com sucesso: ', registration.scope);
            })
            .catch(function(error) {
                console.log('ServiceWorker falhou: ', error);
            });
    });
}
