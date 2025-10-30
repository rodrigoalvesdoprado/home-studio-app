// =============================================
// GERENCIAMENTO DO LOG DE AUDITORIA
// =============================================

class AuditLogManager {
    constructor(app) {
        this.app = app;
        this.currentLogFilters = {
            entity: 'all',
            action: 'all',
            date: ''
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('apply-log-filters').addEventListener('click', () => this.applyLogFilters());
        document.getElementById('clear-log-filters').addEventListener('click', () => this.clearLogFilters());
        document.getElementById('clear-all-logs').addEventListener('click', () => this.clearAllLogs());
    }

    logAction(action, entity, entityId, details = {}) {
        const logEntry = {
            id: Utils.generateId(),
            timestamp: new Date().toISOString(),
            action,
            entity,
            entityId,
            details,
            user: 'system'
        };
        
        this.app.firebaseSync.saveAuditLog(logEntry);
        
        if (document.getElementById('audit').classList.contains('active')) {
            this.renderAuditLog();
            this.updateLogStats();
        }
    }

    renderAuditLog() {
        const auditLogList = document.getElementById('audit-log-list');
        auditLogList.innerHTML = '';
        
        const logs = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
        
        if (logs.length === 0) {
            auditLogList.innerHTML = '<div class="log-entry"><div class="log-details">Nenhum registro de log encontrado.</div></div>';
            return;
        }
        
        let filteredLogs = logs.filter(log => {
            if (this.currentLogFilters.entity !== 'all' && log.entity !== this.currentLogFilters.entity) {
                return false;
            }
            
            if (this.currentLogFilters.action !== 'all' && log.action !== this.currentLogFilters.action) {
                return false;
            }
            
            if (this.currentLogFilters.date) {
                const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                if (logDate !== this.currentLogFilters.date) {
                    return false;
                }
            }
            
            return true;
        });
        
        if (filteredLogs.length === 0) {
            auditLogList.innerHTML = '<div class="log-entry"><div class="log-details">Nenhum registro encontrado com os filtros atuais.</div></div>';
            return;
        }
        
        filteredLogs.forEach(log => {
            const logElement = document.createElement('div');
            logElement.classList.add('log-entry', log.action);
            
            const timestamp = new Date(log.timestamp);
            const formattedTime = timestamp.toLocaleString('pt-BR');
            
            const actionTexts = {
                'create': 'Criado',
                'update': 'Atualizado',
                'delete': 'Excluído',
                'activity': 'Atividade'
            };
            
            const entityTexts = {
                'client': 'Cliente',
                'booking': 'Agendamento',
                'service': 'Serviço' // NOVO
            };
            
            let detailsText = '';
            if (log.action === 'create' || log.action === 'update') {
                if (log.entity === 'client') {
                    detailsText = `Nome: ${log.details.artisticName || log.details.name || 'N/A'}`;
                    if (log.details.document) {
                        detailsText += ` | Documento: ${log.details.document}`;
                    }
                } else if (log.entity === 'booking') {
                    detailsText = `Cliente: ${log.details.clientName || 'N/A'}`;
                    if (log.details.date && log.details.startTime) {
                        detailsText += ` | Data: ${log.details.date} ${log.details.startTime}`;
                    }
                } else if (log.entity === 'service') { // NOVO
                    detailsText = `Nome: ${log.details.name || 'N/A'}`;
                    if (log.details.pricePerHour) {
                        detailsText += ` | Valor/hora: R$ ${log.details.pricePerHour}`;
                    }
                    if (log.details.oldName) {
                        detailsText += ` | Nome anterior: ${log.details.oldName}`;
                    }
                    if (log.details.oldPrice) {
                        detailsText += ` | Valor anterior: R$ ${log.details.oldPrice}`;
                    }
                }
            } else if (log.action === 'delete') {
                detailsText = `ID: ${log.entityId}`;
                if (log.details.name) {
                    detailsText += ` | Nome: ${log.details.name}`;
                }
                if (log.details.pricePerHour) { // NOVO
                    detailsText += ` | Valor/hora: R$ ${log.details.pricePerHour}`;
                }
            } else if (log.action === 'activity') {
                detailsText = log.details.description || 'Atividade registrada';
            }
            
            logElement.innerHTML = `
                <div class="log-header">
                    <span class="log-action ${log.action}">${actionTexts[log.action]} ${entityTexts[log.entity]}</span>
                    <span class="log-timestamp">${formattedTime}</span>
                </div>
                <div class="log-details">
                    ${detailsText}
                </div>
            `;
            
            auditLogList.appendChild(logElement);
        });
    }

    updateLogStats() {
        const logs = JSON.parse(localStorage.getItem('studio_audit_log')) || [];
        const today = new Date().toISOString().split('T')[0];
        
        const totalLogs = logs.length;
        const todayLogs = logs.filter(log => 
            new Date(log.timestamp).toISOString().split('T')[0] === today
        ).length;
        const clientLogs = logs.filter(log => log.entity === 'client').length;
        const bookingLogs = logs.filter(log => log.entity === 'booking').length;
        const serviceLogs = logs.filter(log => log.entity === 'service').length; // NOVO
        
        document.getElementById('total-logs').textContent = totalLogs;
        document.getElementById('today-logs').textContent = todayLogs;
        document.getElementById('client-logs').textContent = clientLogs;
        document.getElementById('booking-logs').textContent = bookingLogs;
        document.getElementById('service-logs').textContent = serviceLogs; // NOVO
    }

    applyLogFilters() {
        this.currentLogFilters.entity = document.getElementById('log-entity').value;
        this.currentLogFilters.action = document.getElementById('log-action').value;
        this.currentLogFilters.date = document.getElementById('log-date').value;
        this.renderAuditLog();
    }

    clearLogFilters() {
        document.getElementById('log-entity').value = 'all';
        document.getElementById('log-action').value = 'all';
        document.getElementById('log-date').value = '';
        this.currentLogFilters = { entity: 'all', action: 'all', date: '' };
        this.renderAuditLog();
    }

    clearAllLogs() {
        if (confirm('Tem certeza que deseja limpar todo o histórico de logs? Esta ação não pode ser desfeita.')) {
            localStorage.setItem('studio_audit_log', JSON.stringify([]));
            this.renderAuditLog();
            this.updateLogStats();
            alert('Todos os logs locais foram limpos com sucesso!');
        }
    }
}

// Exportar para uso global
window.AuditLogManager = AuditLogManager;
