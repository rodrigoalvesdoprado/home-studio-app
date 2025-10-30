// =============================================
// GERENCIAMENTO FINANCEIRO
// =============================================

class FinanceManager {
    constructor(app) {
        this.app = app;
        this.currentSort = { column: 'date', direction: 'desc' };
        this.currentFilters = {
            startDate: '',
            endDate: '',
            clientId: '',
            serviceType: 'all'
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.generateFinanceReport();
    }

    setupEventListeners() {
        document.getElementById('generate-finance-report').addEventListener('click', () => this.generateFinanceReport());
        document.getElementById('clear-finance-filters').addEventListener('click', () => this.clearFilters());
        document.getElementById('export-finance-data').addEventListener('click', () => this.exportFinanceData());
        
        // Ordenação da tabela
        document.querySelectorAll('.finance-table th').forEach(header => {
            header.addEventListener('click', () => this.handleTableSort(header));
        });
    }

    setDefaultDates() {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        document.getElementById('finance-start-date').value = firstDayOfMonth.toISOString().split('T')[0];
        document.getElementById('finance-end-date').value = today.toISOString().split('T')[0];
        
        this.currentFilters.startDate = firstDayOfMonth.toISOString().split('T')[0];
        this.currentFilters.endDate = today.toISOString().split('T')[0];
    }

    generateFinanceReport() {
        this.updateFilters();
        
        const filteredBookings = this.getFilteredBookings();
        this.renderFinanceStats(filteredBookings);
        this.renderFinanceTable(filteredBookings);
        this.updateClientFilter();
    }

    updateFilters() {
        this.currentFilters = {
            startDate: document.getElementById('finance-start-date').value,
            endDate: document.getElementById('finance-end-date').value,
            clientId: document.getElementById('finance-client-filter').value,
            serviceType: document.getElementById('finance-service-filter').value
        };
    }

    getFilteredBookings() {
        let filteredBookings = this.app.bookings.filter(booking => {
            // Filtro por data
            if (this.currentFilters.startDate && booking.date < this.currentFilters.startDate) {
                return false;
            }
            if (this.currentFilters.endDate && booking.date > this.currentFilters.endDate) {
                return false;
            }
            
            // Filtro por cliente
            if (this.currentFilters.clientId && booking.clientId !== this.currentFilters.clientId) {
                return false;
            }
            
            // Filtro por serviço
            if (this.currentFilters.serviceType !== 'all') {
                if (!booking.services || booking.services.length === 0) {
                    return false;
                }
                const hasService = booking.services.some(service => 
                    service.serviceName.toLowerCase().includes(this.currentFilters.serviceType.toLowerCase())
                );
                if (!hasService) {
                    return false;
                }
            }
            
            return true;
        });

        // Aplicar ordenação
        filteredBookings.sort((a, b) => {
            const multiplier = this.currentSort.direction === 'asc' ? 1 : -1;
            
            if (this.currentSort.column === 'date') {
                const dateA = new Date(a.date + 'T' + a.startTime);
                const dateB = new Date(b.date + 'T' + b.startTime);
                return multiplier * (dateA - dateB);
            } else if (this.currentSort.column === 'client') {
                return multiplier * a.clientName.localeCompare(b.clientName);
            } else if (this.currentSort.column === 'revenue') {
                return multiplier * ((a.totalRevenue || 0) - (b.totalRevenue || 0));
            } else if (this.currentSort.column === 'duration') {
                return multiplier * (a.duration - b.duration);
            }
            
            return 0;
        });

        return filteredBookings;
    }

    renderFinanceStats(bookings) {
        const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalRevenue || 0), 0);
        const totalBookings = bookings.length;
        const totalHours = bookings.reduce((sum, booking) => sum + booking.duration, 0);
        
        // Calcular receita por serviço
        const serviceRevenue = {};
        bookings.forEach(booking => {
            if (booking.services) {
                booking.services.forEach(service => {
                    const serviceName = service.serviceName;
                    const revenue = service.pricePerHour * service.hours;
                    
                    if (!serviceRevenue[serviceName]) {
                        serviceRevenue[serviceName] = 0;
                    }
                    serviceRevenue[serviceName] += revenue;
                });
            }
        });
        
        const topService = Object.entries(serviceRevenue).sort((a, b) => b[1] - a[1])[0];
        
        document.getElementById('total-revenue').textContent = `R$ ${totalRevenue.toFixed(2)}`;
        document.getElementById('total-bookings').textContent = totalBookings;
        document.getElementById('total-hours').textContent = `${totalHours}h`;
        document.getElementById('avg-revenue').textContent = totalBookings > 0 ? 
            `R$ ${(totalRevenue / totalBookings).toFixed(2)}` : 'R$ 0.00';
        
        // Estatísticas adicionais
        document.getElementById('unique-clients').textContent = this.getUniqueClientsCount(bookings);
        document.getElementById('top-service').textContent = topService ? 
            `${topService[0]} (R$ ${topService[1].toFixed(2)})` : 'N/A';
    }

    getUniqueClientsCount(bookings) {
        const clientIds = new Set(bookings.map(booking => booking.clientId));
        return clientIds.size;
    }

    renderFinanceTable(bookings) {
        const financeBody = document.getElementById('finance-body');
        financeBody.innerHTML = '';
        
        if (bookings.length === 0) {
            financeBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #aaa;">
                        Nenhum agendamento encontrado com os filtros atuais.
                    </td>
                </tr>
            `;
            return;
        }
        
        bookings.forEach(booking => {
            const row = document.createElement('tr');
            const dateObj = new Date(booking.date);
            const formattedDate = dateObj.toLocaleDateString('pt-BR');
            const endTime = Utils.calculateEndTime(booking.startTime, booking.duration);
            const whatsappLink = `https://wa.me/55${booking.clientPhone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(booking.clientName)}!`;
            
            // Gerar lista de serviços
            let servicesList = 'Nenhum serviço';
            if (booking.services && booking.services.length > 0) {
                servicesList = booking.services.map(service => 
                    `${service.serviceName} (${service.hours}h)`
                ).join(', ');
            }
            
            row.innerHTML = `
                <td>${formattedDate}<br><small>${booking.startTime} - ${endTime}</small></td>
                <td>
                    <strong>${booking.clientName}</strong><br>
                    <small>${booking.clientDocument}</small><br>
                    <a href="${whatsappLink}" target="_blank" class="whatsapp-link">${booking.clientPhone}</a>
                </td>
                <td>${servicesList}</td>
                <td>${booking.duration}h</td>
                <td><strong>R$ ${(booking.totalRevenue || 0).toFixed(2)}</strong></td>
                <td>${booking.notes || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="app.viewBookingDetails('${booking.id}')">
                        Ver Detalhes
                    </button>
                </td>
            `;
            financeBody.appendChild(row);
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
        document.querySelectorAll('.finance-table th').forEach(h => {
            h.innerHTML = h.innerHTML.replace(' ▲', '').replace(' ▼', '');
        });
        
        header.innerHTML += this.currentSort.direction === 'asc' ? ' ▲' : ' ▼';
        
        this.generateFinanceReport();
    }

    updateClientFilter() {
        const clientFilter = document.getElementById('finance-client-filter');
        const currentValue = clientFilter.value;
        
        clientFilter.innerHTML = '<option value="">Todos os clientes</option>';
        
        const clientsWithBookings = this.app.clients.filter(client => 
            this.app.bookings.some(booking => booking.clientId === client.id)
        );
        
        clientsWithBookings.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.artisticName} (${client.document})`;
            clientFilter.appendChild(option);
        });
        
        // Restaurar valor selecionado
        clientFilter.value = currentValue;
    }

    clearFilters() {
        document.getElementById('finance-start-date').value = '';
        document.getElementById('finance-end-date').value = '';
        document.getElementById('finance-client-filter').value = '';
        document.getElementById('finance-service-filter').value = 'all';
        
        this.setDefaultDates();
        this.generateFinanceReport();
    }

    exportFinanceData() {
        const filteredBookings = this.getFilteredBookings();
        
        if (filteredBookings.length === 0) {
            alert('Não há dados para exportar com os filtros atuais.');
            return;
        }
        
        const data = filteredBookings.map(booking => {
            const dateObj = new Date(booking.date);
            const formattedDate = dateObj.toLocaleDateString('pt-BR');
            const endTime = Utils.calculateEndTime(booking.startTime, booking.duration);
            
            let servicesExport = 'Nenhum serviço';
            if (booking.services && booking.services.length > 0) {
                servicesExport = booking.services.map(service => 
                    `${service.serviceName} - R$ ${service.pricePerHour}/h × ${service.hours}h = R$ ${(service.pricePerHour * service.hours).toFixed(2)}`
                ).join('; ');
            }
            
            return {
                'Data': formattedDate,
                'Horário': `${booking.startTime} - ${endTime}`,
                'Cliente': booking.clientName,
                'Documento': booking.clientDocument,
                'Telefone': booking.clientPhone,
                'Serviços': servicesExport,
                'Duração (h)': booking.duration,
                'Valor Total (R$)': booking.totalRevenue?.toFixed(2) || '0.00',
                'Observações': booking.notes || '',
                'Data do Agendamento': new Date(booking.createdAt).toLocaleDateString('pt-BR')
            };
        });
        
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_financeiro_catarse_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('Relatório financeiro exportado com sucesso!');
    }

    // Método para gerar relatório específico por cliente
    generateClientReport(clientId, startDate = '', endDate = '') {
        const clientBookings = this.app.bookings.filter(booking => {
            if (booking.clientId !== clientId) return false;
            if (startDate && booking.date < startDate) return false;
            if (endDate && booking.date > endDate) return false;
            return true;
        });
        
        const totalRevenue = clientBookings.reduce((sum, booking) => sum + (booking.totalRevenue || 0), 0);
        const totalHours = clientBookings.reduce((sum, booking) => sum + booking.duration, 0);
        const totalSessions = clientBookings.length;
        
        return {
            client: this.app.clients.find(c => c.id === clientId),
            bookings: clientBookings,
            stats: {
                totalRevenue,
                totalHours,
                totalSessions,
                avgRevenuePerSession: totalSessions > 0 ? totalRevenue / totalSessions : 0
            }
        };
    }

    // Método para obter estatísticas gerais
    getFinancialStats(startDate = '', endDate = '') {
        const filteredBookings = this.app.bookings.filter(booking => {
            if (startDate && booking.date < startDate) return false;
            if (endDate && booking.date > endDate) return false;
            return true;
        });
        
        const totalRevenue = filteredBookings.reduce((sum, booking) => sum + (booking.totalRevenue || 0), 0);
        const totalBookings = filteredBookings.length;
        const totalHours = filteredBookings.reduce((sum, booking) => sum + booking.duration, 0);
        const uniqueClients = new Set(filteredBookings.map(booking => booking.clientId)).size;
        
        // Receita por serviço
        const serviceRevenue = {};
        filteredBookings.forEach(booking => {
            if (booking.services) {
                booking.services.forEach(service => {
                    const serviceName = service.serviceName;
                    const revenue = service.pricePerHour * service.hours;
                    
                    if (!serviceRevenue[serviceName]) {
                        serviceRevenue[serviceName] = { revenue: 0, hours: 0, sessions: 0 };
                    }
                    serviceRevenue[serviceName].revenue += revenue;
                    serviceRevenue[serviceName].hours += service.hours;
                    serviceRevenue[serviceName].sessions += 1;
                });
            }
        });
        
        // Top clientes
        const clientRevenue = {};
        filteredBookings.forEach(booking => {
            if (!clientRevenue[booking.clientId]) {
                clientRevenue[booking.clientId] = {
                    name: booking.clientName,
                    revenue: 0,
                    sessions: 0
                };
            }
            clientRevenue[booking.clientId].revenue += (booking.totalRevenue || 0);
            clientRevenue[booking.clientId].sessions += 1;
        });
        
        const topClients = Object.entries(clientRevenue)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5);
        
        return {
            totalRevenue,
            totalBookings,
            totalHours,
            uniqueClients,
            avgRevenuePerBooking: totalBookings > 0 ? totalRevenue / totalBookings : 0,
            avgRevenuePerHour: totalHours > 0 ? totalRevenue / totalHours : 0,
            serviceRevenue,
            topClients
        };
    }
}

// Exportar para uso global
window.FinanceManager = FinanceManager;
