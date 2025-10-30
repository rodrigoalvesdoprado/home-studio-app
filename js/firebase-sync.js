// =============================================
// SISTEMA DE SINCRONIZAÇÃO FIREBASE
// =============================================

class FirebaseSync {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.lastSync = localStorage.getItem('last_sync') || null;
        this.initFirebase();
        this.init();
    }

    initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyACxXMIS1glacTnxzMS-UQAMZR6dm3WYDI",
            authDomain: "catarse-home-studio.firebaseapp.com",
            projectId: "catarse-home-studio",
            storageBucket: "catarse-home-studio.appspot.com",
            messagingSenderId: "459212604797",
            appId: "1:459212604797:web:4a3f402028d367a5673814"
        };

        firebase.initializeApp(firebaseConfig);
        this.db = firebase.firestore();
    }

    init() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        setInterval(() => {
            if (this.isOnline && !this.syncInProgress) {
                this.syncData();
            }
        }, 30000);

        if (this.isOnline) {
            setTimeout(() => this.syncData(), 2000);
        }
    }

    handleOnline() {
        this.isOnline = true;
        this.updateConnectionStatus('online', 'Conectado');
        this.syncData();
    }

    handleOffline() {
        this.isOnline = false;
        this.updateConnectionStatus('offline', 'Offline');
    }

    updateConnectionStatus(status, text) {
        const statusElement = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        
        if (statusElement && statusText) {
            statusElement.className = `connection-status ${status}`;
            statusText.textContent = text;
        }
    }

    setSyncing(status) {
        const statusElement = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        
        if (status) {
            statusElement.className = 'connection-status syncing';
            statusText.textContent = 'Sincronizando...';
            this.syncInProgress = true;
        } else {
            this.syncInProgress = false;
            this.updateConnectionStatus(
                this.isOnline ? 'online' : 'offline',
                this.isOnline ? 'Conectado' : 'Offline'
            );
        }
    }

    async syncData() {
        if (this.syncInProgress || !this.isOnline) return;
        
        this.setSyncing(true);
        try {
            console.log('🔄 Iniciando sincronização Firebase...');
            
            await this.syncClients();
            await this.syncBookings();
            await this.syncServices(); // NOVO
            await this.syncAuditLogs();
            
            localStorage.setItem('last_sync', new Date().toISOString());
            console.log('✅ Sincronização concluída com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
        } finally {
            this.setSyncing(false);
        }
    }

    async syncClients() {
        try {
            const snapshot = await this.db.collection('clientes').get();
            const firebaseClients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const localClients = JSON.parse(localStorage.getItem('studio_clients')) || [];
            const mergedClients = this.mergeData(localClients, firebaseClients, 'clientes');
            
            localStorage.setItem('studio_clients', JSON.stringify(mergedClients));
            
            const localUpdates = this.getLocalUpdates(localClients, firebaseClients, 'clientes');
            for (const client of localUpdates) {
                await this.db.collection('clientes').doc(client.id).set(client, { merge: true });
            }

            return mergedClients;
        } catch (error) {
            console.error('❌ Erro ao sincronizar clientes:', error);
            throw error;
        }
    }

    async syncBookings() {
        try {
            const snapshot = await this.db.collection('agendamentos').get();
            const firebaseBookings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const localBookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
            const mergedBookings = this.mergeData(localBookings, firebaseBookings, 'agendamentos');
            
            localStorage.setItem('studio_bookings', JSON.stringify(mergedBookings));
            
            const localUpdates = this.getLocalUpdates(localBookings, firebaseBookings, 'agendamentos');
            for (const booking of localUpdates) {
                await this.db.collection('agendamentos').doc(booking.id).set(booking, { merge: true });
            }

            return mergedBookings;
        } catch (error) {
            console.error('❌ Erro ao sincronizar agendamentos:', error);
            throw error;
        }
    }

    // NOVO: Sincronização de serviços
    async syncServices() {
        try {
            const snapshot = await this.db.collection('servicos').get();
            const firebaseServices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const localServices = JSON.parse(localStorage.getItem('studio_services')) || [];
            const mergedServices = this.mergeData(localServices, firebaseServices, 'servicos');
            
            localStorage.setItem('studio_services', JSON.stringify(mergedServices));
            
            const localUpdates = this.getLocalUpdates(localServices, firebaseServices, 'servicos');
            for (const service of localUpdates) {
                await this.db.collection('servicos').doc(service.id).set(service, { merge: true });
            }

            console.log(`✅ Serviços sincronizados: ${mergedServices.length} serviços`);
            return mergedServices;
        } catch (error) {
            console.error('❌ Erro ao sincronizar serviços:', error);
            throw error;
        }
    }

    async syncAuditLogs() {
        try {
            const snapshot = await this.db.collection('audit_logs').orderBy('timestamp', 'desc').limit(1000).get();
            const firebaseLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const localLogs = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
            const mergedLogs = this.mergeData(localLogs, firebaseLogs, 'logs');
            
            localStorage.setItem('studio_audit_log', JSON.stringify(mergedLogs));
            
            const newLocalLogs = localLogs.filter(localLog => 
                !firebaseLogs.some(fbLog => fbLog.id === localLog.id)
            );
            
            for (const log of newLocalLogs) {
                await this.db.collection('audit_logs').doc(log.id).set(log);
            }

            return mergedLogs;
        } catch (error) {
            console.error('❌ Erro ao sincronizar logs:', error);
            throw error;
        }
    }

    // CORRIGIDO: Método mergeData para evitar duplicatas
    mergeData(localData, firebaseData, dataType) {
        const merged = [...firebaseData];
        const localMap = new Map(localData.map(item => [item.id, item]));
        
        for (const localItem of localData) {
            // NOVO: Tenta encontrar por documento também, não só por ID
            const existingByDocument = merged.find(item => 
                item.document && localItem.document && 
                this.cleanDocument(item.document) === this.cleanDocument(localItem.document)
            );
            
            if (existingByDocument) {
                // Se encontrou pelo documento, usa o ID do Firebase mas mantém dados mais recentes
                const existingIndex = merged.findIndex(item => item.id === existingByDocument.id);
                const localUpdated = new Date(localItem.updatedAt || localItem.timestamp || 0);
                const firebaseUpdated = new Date(existingByDocument.updatedAt || existingByDocument.timestamp || 0);
                
                if (localUpdated > firebaseUpdated) {
                    // Mantém o ID do Firebase mas atualiza com dados locais
                    merged[existingIndex] = {
                        ...localItem,
                        id: existingByDocument.id // GARANTE MESMO ID
                    };
                }
            } else {
                // Item novo - verifica se já existe pelo ID
                const existingIndex = merged.findIndex(item => item.id === localItem.id);
                
                if (existingIndex === -1) {
                    merged.push(localItem);
                } else {
                    const existing = merged[existingIndex];
                    const localUpdated = new Date(localItem.updatedAt || localItem.timestamp || 0);
                    const firebaseUpdated = new Date(existing.updatedAt || existing.timestamp || 0);
                    
                    if (localUpdated > firebaseUpdated) {
                        merged[existingIndex] = localItem;
                    }
                }
            }
        }
        
        return merged;
    }

    // NOVO: Método auxiliar para limpar documento
    cleanDocument(document) {
        return document ? document.replace(/\D/g, '') : '';
    }

    getLocalUpdates(localData, firebaseData, dataType) {
        const firebaseMap = new Map(firebaseData.map(item => [item.id, item]));
        return localData.filter(localItem => {
            const firebaseItem = firebaseMap.get(localItem.id);
            if (!firebaseItem) return true;
            
            const localUpdated = new Date(localItem.updatedAt || localItem.timestamp || 0);
            const firebaseUpdated = new Date(firebaseItem.updatedAt || firebaseItem.timestamp || 0);
            
            return localUpdated > firebaseUpdated;
        });
    }

    // Métodos para salvar dados individualmente
    async saveClient(client) {
        try {
            let clients = JSON.parse(localStorage.getItem('studio_clients')) || [];
            const index = clients.findIndex(c => c.id === client.id);
            
            if (index === -1) {
                clients.push(client);
            } else {
                clients[index] = client;
            }
            
            localStorage.setItem('studio_clients', JSON.stringify(clients));
            
            if (this.isOnline) {
                await this.db.collection('clientes').doc(client.id).set(client, { merge: true });
            }
            
            return client;
        } catch (error) {
            console.error('❌ Erro ao salvar cliente:', error);
            throw error;
        }
    }

    async saveBooking(booking) {
        try {
            let bookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
            const index = bookings.findIndex(b => b.id === booking.id);
            
            if (index === -1) {
                bookings.push(booking);
            } else {
                bookings[index] = booking;
            }
            
            localStorage.setItem('studio_bookings', JSON.stringify(bookings));
            
            if (this.isOnline) {
                await this.db.collection('agendamentos').doc(booking.id).set(booking, { merge: true });
            }
            
            return booking;
        } catch (error) {
            console.error('❌ Erro ao salvar agendamento:', error);
            throw error;
        }
    }

    // NOVO: Método para salvar serviço
    async saveService(service) {
        try {
            let services = JSON.parse(localStorage.getItem('studio_services')) || [];
            const index = services.findIndex(s => s.id === service.id);
            
            if (index === -1) {
                services.push(service);
            } else {
                services[index] = service;
            }
            
            localStorage.setItem('studio_services', JSON.stringify(services));
            
            if (this.isOnline) {
                await this.db.collection('servicos').doc(service.id).set(service, { merge: true });
            }
            
            console.log(`💾 Serviço salvo: ${service.name}`);
            return service;
        } catch (error) {
            console.error('❌ Erro ao salvar serviço:', error);
            throw error;
        }
    }

    async saveAuditLog(log) {
        try {
            let logs = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
            logs.unshift(log);
            
            if (logs.length > 1000) {
                logs = logs.slice(0, 1000);
            }
            
            localStorage.setItem('studio_audit_log', JSON.stringify(logs));
            
            if (this.isOnline) {
                await this.db.collection('audit_logs').doc(log.id).set(log);
            }
            
            return log;
        } catch (error) {
            console.error('❌ Erro ao salvar log:', error);
            throw error;
        }
    }

    async deleteClient(clientId) {
        try {
            let clients = JSON.parse(localStorage.getItem('studio_clients')) || [];
            clients = clients.filter(c => c.id !== clientId);
            localStorage.setItem('studio_clients', JSON.stringify(clients));
            
            if (this.isOnline) {
                await this.db.collection('clientes').doc(clientId).delete();
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao excluir cliente:', error);
            throw error;
        }
    }

    async deleteBooking(bookingId) {
        try {
            let bookings = JSON.parse(localStorage.getItem('studio_bookings')) || [];
            bookings = bookings.filter(b => b.id !== bookingId);
            localStorage.setItem('studio_bookings', JSON.stringify(bookings));
            
            if (this.isOnline) {
                await this.db.collection('agendamentos').doc(bookingId).delete();
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao excluir agendamento:', error);
            throw error;
        }
    }

    // NOVO: Método para excluir serviço
    async deleteService(serviceId) {
        try {
            let services = JSON.parse(localStorage.getItem('studio_services')) || [];
            services = services.filter(s => s.id !== serviceId);
            localStorage.setItem('studio_services', JSON.stringify(services));
            
            if (this.isOnline) {
                await this.db.collection('servicos').doc(serviceId).delete();
            }
            
            console.log(`🗑️ Serviço excluído: ${serviceId}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao excluir serviço:', error);
            throw error;
        }
    }
}

// Exportar para uso global
window.FirebaseSync = FirebaseSync;
