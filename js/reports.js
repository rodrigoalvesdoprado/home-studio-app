// =============================================
// GERENCIAMENTO DE RELATÓRIOS
// =============================================

class ReportsManager {
    constructor(app) {
        this.app = app;
        this.currentSort = { column: 'hours', direction: 'desc' };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.generateReport();
    }

    setupEventListeners() {
        document.getElementById('generate-report').addEventListener('click', () => this.generateReport());
        
        // Ordenação da tabela
        document.querySelectorAll('.report-table th').forEach(header => {
            header.addEventListener('click', () => this.handleTableSort(header));
        });
    }

    setDefaultDates() {
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        document.getElementById('report-start-date').value = lastMonth.toISOString().split('T')[0];
        document.getElementById('report-end-date').value = today.toISOString().split('T')[0];
    }

    generateReport() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        
        // Se não há datas definidas, usa o último mês como padrão
        const defaultStartDate = new Date();
        defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);
        
        const start = startDate || defaultStartDate.toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        document.getElementById('report-start-date').value = start;
        document.getElementById('report-end-date').value = end;
        
        // Calcula as horas por cliente
        const clientHours = {};
        
        this.app.bookings.forEach(booking => {
            if (booking.date >= start && booking.date <= end) {
                if (!clientHours[booking.clientId]) {
                    clientHours[booking.clientId] = {
                        name: booking.clientName,
                        phone: booking.clientPhone,
                        hours: 0,
                        sessions: 0
                    };
                }
                
                clientHours[booking.clientId].hours += booking.duration;
                clientHours[booking.clientId].sessions += 1;
            }
        });
        
        // Converte para array e ordena
        let reportData = Object.keys(clientHours).map(clientId => ({
            id: clientId,
            name: clientHours[clientId].name,
            phone: clientHours[clientId].phone,
            hours: clientHours[clientId].hours,
            sessions: clientHours[clientId].sessions
        }));
        
        // Aplica a ordenação atual
        reportData.sort((a, b) => {
            const multiplier = this.currentSort.direction === 'asc' ? 1 : -1;
            
            if (this.currentSort.column === 'name') {
                return multiplier * a.name.localeCompare(b.name);
            } else if (this.currentSort.column === 'hours') {
                return multiplier * (a.hours - b.hours);
            } else if (this.currentSort.column === 'sessions') {
                return multiplier * (a.sessions - b.sessions);
            }
            
            return 0;
        });
        
        // Renderiza a tabela
        this.renderReportTable(reportData);
    }

    renderReportTable(reportData) {
        const reportBody = document.getElementById('report-body');
        reportBody.innerHTML = '';
        
        if (reportData.length === 0) {
            reportBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum dado encontrado para o período selecionado.</td></tr>';
            return;
        }
        
        reportData.forEach(item => {
            const row = document.createElement('tr');
            const whatsappLink = `https://wa.me/55${item.phone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(item.name)}! Vi que você utilizou nosso home studio recentemente.`;
            
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.hours} horas</td>
                <td>${item.sessions} sessões</td>
                <td><a href="${whatsappLink}" target="_blank" class="whatsapp-link">${item.phone}</a></td>
            `;
            reportBody.appendChild(row);
        });
    }

    handleTableSort(header) {
        const column = header.getAttribute('data-sort');
        
        // Alterna a direção se clicar na mesma coluna
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }
        
        // Atualiza os cabeçalhos
        document.querySelectorAll('.report-table th').forEach(h => {
            h.innerHTML = h.innerHTML.replace(' ▲', '').replace(' ▼', '');
        });
        
        header.innerHTML += this.currentSort.direction === 'asc' ? ' ▲' : ' ▼';
        
        this.generateReport();
    }
}

// Exportar para uso global
window.ReportsManager = ReportsManager;