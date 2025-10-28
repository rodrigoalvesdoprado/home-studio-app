// =============================================
// GERENCIAMENTO DE AGENDAMENTOS
// =============================================

class BookingsManager {
    constructor(app) {
        this.app = app;
        this.editingBookingId = null;
        this.selectedBookingId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupModals();
    }

    setupEventListeners() {
        // Formulário de agendamento
        document.getElementById('booking-form').addEventListener('submit', (e) => this.handleBookingSubmit(e));
        document.getElementById('booking-cancel-btn').addEventListener('click', () => this.resetBookingForm());
        
        // Ações de agendamento
        document.getElementById('edit-booking-btn').addEventListener('click', () => this.editBooking());
        document.getElementById('delete-booking-btn').addEventListener('click', () => this.deleteBooking());
    }

    setupModals() {
        // Fechar modais
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        
        // Fechar modal ao clicar fora
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });
    }

    async handleBookingSubmit(e) {
        e.preventDefault();
        
        const date = document.getElementById('booking-date').value;
        const clientId = document.getElementById('booking-client').value;
        const startTime = document.getElementById('booking-start').value;
        const duration = parseInt(document.getElementById('booking-duration').value);
        const notes = document.getElementById('booking-notes').value;
        const bookingId = document.getElementById('booking-id').value;
        
        // Validações
        if (!clientId) {
            alert('Por favor, selecione um cliente.');
            return;
        }
        
        if (!startTime) {
            alert('Por favor, selecione um horário de início.');
            return;
        }
        
        // Verifica se o horário ainda está disponível
        const startHour = parseInt(startTime.split(':')[0]);
        let isBooked = false;
        
        for (let hour = startHour; hour < startHour + duration; hour++) {
            if (this.app.bookings.some(booking => 
                booking.date === date && 
                this.isTimeSlotBooked(booking, hour) &&
                booking.id !== bookingId
            )) {
                isBooked = true;
                break;
            }
        }
        
        if (isBooked) {
            alert('Este horário já foi reservado. Por favor, selecione outro.');
            return;
        }
        
        // Encontra o cliente
        const client = this.app.clients.find(c => c.id === clientId);
        if (!client) {
            alert('Cliente não encontrado.');
            return;
        }
        
        if (bookingId) {
            // Atualiza o agendamento existente
            const bookingIndex = this.app.bookings.findIndex(b => b.id === bookingId);
            if (bookingIndex !== -1) {
                const oldBooking = this.app.bookings[bookingIndex];
                const updatedBooking = {
                    ...oldBooking,
                    date,
                    startTime,
                    duration,
                    clientId,
                    clientName: client.artisticName,
                    clientDocument: client.document,
                    clientPhone: client.phone,
                    notes,
                    updatedAt: new Date().toISOString()
                };
                
                this.app.bookings[bookingIndex] = updatedBooking;
                await this.app.firebaseSync.saveBooking(updatedBooking);
                
                this.app.logAction('update', 'booking', bookingId, {
                    clientName: client.artisticName,
                    date: date,
                    startTime: startTime,
                    duration: duration,
                    oldDate: oldBooking.date,
                    oldStartTime: oldBooking.startTime,
                    oldDuration: oldBooking.duration
                });
            }
        } else {
            // Cria um novo agendamento
            const booking = {
                id: Utils.generateId(),
                date,
                startTime,
                duration,
                clientId,
                clientName: client.artisticName,
                clientDocument: client.document,
                clientPhone: client.phone,
                notes,
                activitiesCompleted: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.app.bookings.push(booking);
            await this.app.firebaseSync.saveBooking(booking);
            
            this.app.logAction('create', 'booking', booking.id, {
                clientName: client.artisticName,
                date: date,
                startTime: startTime,
                duration: duration
            });
        }
        
        alert(bookingId ? 'Agendamento atualizado com sucesso!' : 'Agendamento realizado com sucesso!');
        this.closeModals();
        this.app.calendar.refresh();
        this.renderBookingsList();
        this.resetBookingForm();
    }

    isTimeSlotBooked(booking, hour) {
        const bookingStartHour = parseInt(booking.startTime.split(':')[0]);
        const bookingEndHour = bookingStartHour + booking.duration;
        return hour >= bookingStartHour && hour < bookingEndHour;
    }

    openBookingModal(date, startTime, bookingId = null) {
        document.getElementById('booking-date').value = date;
        document.getElementById('booking-id').value = bookingId || '';
        
        // Preenche o select de clientes
        const bookingClientSelect = document.getElementById('booking-client');
        bookingClientSelect.innerHTML = '<option value="">Selecione um cliente</option>';
        this.app.clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.artisticName} (${client.document})`;
            bookingClientSelect.appendChild(option);
        });
        
        // Preenche o select de horários de início
        const bookingStartSelect = document.getElementById('booking-start');
        bookingStartSelect.innerHTML = '<option value="">Selecione o horário de início</option>';
        for (let hour = 8; hour <= 22; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            
            // Verifica se o horário está disponível
            const isBooked = this.app.bookings.some(booking => 
                booking.date === date && 
                this.isTimeSlotBooked(booking, hour) &&
                booking.id !== bookingId
            );
            
            if (!isBooked) {
                const option = document.createElement('option');
                option.value = timeStr;
                option.textContent = timeStr;
                if (startTime === timeStr) {
                    option.selected = true;
                }
                bookingStartSelect.appendChild(option);
            }
        }
        
        // Se estamos editando, preenche os outros campos
        if (bookingId) {
            const booking = this.app.bookings.find(b => b.id === bookingId);
            if (booking) {
                bookingClientSelect.value = booking.clientId;
                bookingStartSelect.value = booking.startTime;
                document.getElementById('booking-duration').value = booking.duration;
                document.getElementById('booking-notes').value = booking.notes || '';
                
                document.getElementById('booking-submit-btn').textContent = 'Atualizar Agendamento';
                document.getElementById('booking-cancel-btn').style.display = 'inline-block';
                this.editingBookingId = bookingId;
            }
        } else {
            document.getElementById('booking-submit-btn').textContent = 'Confirmar Agendamento';
            document.getElementById('booking-cancel-btn').style.display = 'none';
            this.editingBookingId = null;
        }
        
        document.getElementById('booking-modal').classList.add('active');
    }

    viewBookingDetails(bookingId) {
        this.selectedBookingId = bookingId;
        const booking = this.app.bookings.find(b => b.id === bookingId);
        
        if (!booking) {
            alert('Agendamento não encontrado.');
            return;
        }
        
        const client = this.app.clients.find(c => c.id === booking.clientId);
        const endTime = Utils.calculateEndTime(booking.startTime, booking.duration);
        const dateObj = new Date(booking.date);
        const formattedDate = dateObj.toLocaleDateString('pt-BR');
        const whatsappLink = `https://wa.me/55${booking.clientPhone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(booking.clientName)}! Vi que você tem um agendamento conosco.`;
        
        const bookingDetailsContent = document.getElementById('booking-details-content');
        bookingDetailsContent.innerHTML = `
            <div class="agendamento-detalhes">
                <h3>Detalhes do Agendamento</h3>
                
                <div class="agendamento-info">
                    <div class="info-item">
                        <div class="info-label">Cliente:</div>
                        <div>${booking.clientName}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Documento:</div>
                        <div>${booking.clientDocument}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Telefone:</div>
                        <div><a href="${whatsappLink}" target="_blank" class="whatsapp-link">${booking.clientPhone}</a></div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Data:</div>
                        <div>${formattedDate}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Horário:</div>
                        <div>${booking.startTime} - ${endTime} (${booking.duration}h)</div>
                    </div>
                </div>
                
                <div class="activities-section">
                    <h4>Atividades Planejadas</h4>
                    <p>${booking.notes || 'Nenhuma descrição fornecida'}</p>
                </div>
                
                <div class="activities-section">
                    <h4>Atividades Realizadas</h4>
                    <textarea id="completed-activities" rows="4" placeholder="Descreva as atividades realizadas durante a sessão...">${booking.activitiesCompleted || ''}</textarea>
                    <button class="btn btn-success" onclick="app.saveCompletedActivities('${booking.id}')" style="margin-top: 10px;">Salvar Atividades Realizadas</button>
                </div>
            </div>
        `;
        
        document.getElementById('booking-details-modal').classList.add('active');
    }

    async saveCompletedActivities(bookingId) {
        const activities = document.getElementById('completed-activities').value;
        const bookingIndex = this.app.bookings.findIndex(b => b.id === bookingId);
        
        if (bookingIndex !== -1) {
            const updatedBooking = {
                ...this.app.bookings[bookingIndex],
                activitiesCompleted: activities,
                updatedAt: new Date().toISOString()
            };
            
            this.app.bookings[bookingIndex] = updatedBooking;
            await this.app.firebaseSync.saveBooking(updatedBooking);
            
            this.app.logAction('activity', 'booking', bookingId, {
                clientName: this.app.bookings[bookingIndex].clientName,
                description: 'Atividades realizadas atualizadas',
                date: this.app.bookings[bookingIndex].date
            });
            
            alert('Atividades realizadas salvas com sucesso!');
        }
    }

    editBooking() {
        if (this.selectedBookingId) {
            const booking = this.app.bookings.find(b => b.id === this.selectedBookingId);
            if (booking) {
                this.closeModals();
                this.openBookingModal(booking.date, booking.startTime, booking.id);
            }
        }
    }

    async deleteBooking() {
        if (this.selectedBookingId && confirm('Tem certeza que deseja excluir este agendamento?')) {
            const booking = this.app.bookings.find(b => b.id === this.selectedBookingId);
            this.app.bookings = this.app.bookings.filter(booking => booking.id !== this.selectedBookingId);
            
            await this.app.firebaseSync.deleteBooking(this.selectedBookingId);
            
            this.app.logAction('delete', 'booking', this.selectedBookingId, {
                clientName: booking.clientName,
                date: booking.date,
                startTime: booking.startTime
            });
            
            this.closeModals();
            
            // Atualiza as visualizações
            this.app.calendar.refresh();
            this.renderBookingsList();
            
            alert('Agendamento excluído com sucesso!');
        }
    }

    renderBookingsList() {
        const bookingsList = document.getElementById('bookings-list');
        bookingsList.innerHTML = '';
        
        if (this.app.bookings.length === 0) {
            bookingsList.innerHTML = '<p>Nenhum agendamento realizado ainda.</p>';
            return;
        }
        
        // Ordena os agendamentos por data e horário (mais recentes primeiro)
        const sortedBookings = [...this.app.bookings].sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.startTime);
            const dateB = new Date(b.date + 'T' + b.startTime);
            return dateB - dateA;
        });
        
        sortedBookings.forEach(booking => {
            const bookingElement = document.createElement('div');
            bookingElement.classList.add('booking-item');
            
            const dateObj = new Date(booking.date);
            const formattedDate = dateObj.toLocaleDateString('pt-BR');
            const endTime = Utils.calculateEndTime(booking.startTime, booking.duration);
            const whatsappLink = `https://wa.me/55${booking.clientPhone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(booking.clientName)}! Vi que você tem um agendamento conosco.`;
            
            bookingElement.innerHTML = `
                <div class="booking-info">
                    <h3>${booking.clientName}</h3>
                    <p>Data: ${formattedDate}</p>
                    <p>Horário: ${booking.startTime} - ${endTime} (${booking.duration}h)</p>
                    <p>Documento: ${booking.clientDocument}</p>
                    <p>Telefone: <a href="${whatsappLink}" target="_blank" class="whatsapp-link">${booking.clientPhone}</a></p>
                    ${booking.notes ? `<p>Atividade: ${booking.notes}</p>` : ''}
                </div>
                <div class="booking-actions">
                    <button class="btn btn-secondary" onclick="app.viewBookingDetails('${booking.id}')">Ver Detalhes</button>
                </div>
            `;
            bookingsList.appendChild(bookingElement);
        });
    }

    resetBookingForm() {
        document.getElementById('booking-form').reset();
        document.getElementById('booking-id').value = '';
        document.getElementById('booking-submit-btn').textContent = 'Confirmar Agendamento';
        document.getElementById('booking-cancel-btn').style.display = 'none';
        this.editingBookingId = null;
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        this.resetBookingForm();
        this.app.clientsManager.resetClientForm();
    }
}

// Exportar para uso global
window.BookingsManager = BookingsManager;