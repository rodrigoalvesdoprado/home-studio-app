// =============================================
// GERENCIAMENTO DO CALENDÁRIO
// =============================================

class CalendarManager {
    constructor(app) {
        this.app = app;
        this.currentDate = new Date();
        this.selectedDate = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderCalendar();
    }

    setupEventListeners() {
        document.getElementById('prev-month').addEventListener('click', () => this.previousMonth());
        document.getElementById('next-month').addEventListener('click', () => this.nextMonth());
        document.getElementById('new-booking').addEventListener('click', () => this.openNewBookingModal());
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Atualiza o cabeçalho do mês
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
        
        // Limpa o calendário
        const calendarDays = document.getElementById('calendar-days');
        calendarDays.innerHTML = '';
        
        // Adiciona os cabeçalhos dos dias da semana
        const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.textContent = day;
            dayElement.style.fontWeight = 'bold';
            dayElement.style.textAlign = 'center';
            calendarDays.appendChild(dayElement);
        });
        
        // Primeiro dia do mês
        const firstDay = new Date(year, month, 1);
        // Último dia do mês
        const lastDay = new Date(year, month + 1, 0);
        
        // Dias do mês anterior para preencher o início
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const startingDay = firstDay.getDay();
        
        // Dias do próximo mês para preencher o final
        const endingDay = lastDay.getDay();
        
        // Adiciona os dias do mês anterior
        for (let i = startingDay - 1; i >= 0; i--) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day', 'other-month');
            dayElement.innerHTML = `<div class="day-number">${prevMonthLastDay - i}</div>`;
            calendarDays.appendChild(dayElement);
        }
        
        // Adiciona os dias do mês atual
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day');
            dayElement.innerHTML = `<div class="day-number">${i}</div>`;
            
            // Verifica se há agendamentos neste dia
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const dayBookings = this.app.bookings.filter(booking => booking.date === dateStr);
            
            if (dayBookings.length > 0) {
                dayElement.classList.add('has-booking');
                dayElement.innerHTML += `<div class="day-bookings">${dayBookings.length} agendamento(s)</div>`;
                
                // Adiciona indicadores visuais
                const indicators = document.createElement('div');
                indicators.classList.add('booking-indicators');
                
                const maxIndicators = Math.min(dayBookings.length, 5);
                for (let j = 0; j < maxIndicators; j++) {
                    const indicator = document.createElement('div');
                    indicator.classList.add('booking-indicator');
                    indicators.appendChild(indicator);
                }
                
                dayElement.appendChild(indicators);
            }
            
            dayElement.addEventListener('click', () => this.selectDate(year, month, i));
            calendarDays.appendChild(dayElement);
        }
        
        // Adiciona os dias do próximo mês
        for (let i = 1; i <= (6 - endingDay); i++) {
            const dayElement = document.createElement('div');
            dayElement.classList.add('calendar-day', 'other-month');
            dayElement.innerHTML = `<div class="day-number">${i}</div>`;
            calendarDays.appendChild(dayElement);
        }
    }

    selectDate(year, month, day) {
        this.selectedDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Atualiza o cabeçalho do dia
        const dateObj = new Date(year, month, day);
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        document.getElementById('selected-day').textContent = 
            `Agendamentos para ${dayNames[dateObj.getDay()]}, ${day} de ${monthNames[month]} de ${year}`;
        
        // Mostra os agendamentos do dia
        this.renderDayAgendamentos(this.selectedDate);
        
        // Mostra os horários disponíveis
        this.renderTimeSlots(this.selectedDate);
        
        // Mostra a seção de detalhes do dia
        document.getElementById('day-details').style.display = 'block';
    }

    renderDayAgendamentos(date) {
        const dayAgendamentos = document.getElementById('day-agendamentos');
        dayAgendamentos.innerHTML = '';
        
        const dayBookings = this.app.bookings.filter(booking => booking.date === date);
        
        if (dayBookings.length === 0) {
            dayAgendamentos.innerHTML = '<p>Nenhum agendamento para este dia.</p>';
            return;
        }
        
        // Ordena os agendamentos por horário
        dayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        dayBookings.forEach(booking => {
            const bookingElement = document.createElement('div');
            bookingElement.classList.add('booking-item');
            
            const endTime = Utils.calculateEndTime(booking.startTime, booking.duration);
            const whatsappLink = `https://wa.me/55${booking.clientPhone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(booking.clientName)}! Vi que você tem um agendamento conosco.`;
            
            bookingElement.innerHTML = `
                <div class="booking-info">
                    <h3>${booking.clientName}</h3>
                    <p>Horário: ${booking.startTime} - ${endTime} (${booking.duration}h)</p>
                    <p>Atividade: ${booking.notes || 'Nenhuma descrição fornecida'}</p>
                    <p>Telefone: <a href="${whatsappLink}" target="_blank" class="whatsapp-link">${booking.clientPhone}</a></p>
                </div>
                <div class="booking-actions">
                    <button class="btn btn-secondary" onclick="app.viewBookingDetails('${booking.id}')">Ver Detalhes</button>
                </div>
            `;
            dayAgendamentos.appendChild(bookingElement);
        });
    }

    renderTimeSlots(date) {
        const timeSlots = document.getElementById('time-slots');
        timeSlots.innerHTML = '';
        
        // Horários disponíveis (das 8h às 22h)
        for (let hour = 8; hour <= 22; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeSlot.setAttribute('data-time', `${hour.toString().padStart(2, '0')}:00`);
            
            // Verifica se o horário está ocupado
            const isBooked = this.app.bookings.some(booking => 
                booking.date === date && 
                this.isTimeSlotBooked(booking, hour)
            );
            
            if (isBooked) {
                timeSlot.classList.add('booked');
            } else {
                timeSlot.addEventListener('click', function() {
                    app.openBookingModal(date, this.getAttribute('data-time'));
                });
            }
            
            timeSlots.appendChild(timeSlot);
        }
    }

    isTimeSlotBooked(booking, hour) {
        const bookingStartHour = parseInt(booking.startTime.split(':')[0]);
        const bookingEndHour = bookingStartHour + booking.duration;
        
        return hour >= bookingStartHour && hour < bookingEndHour;
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
        document.getElementById('day-details').style.display = 'none';
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
        document.getElementById('day-details').style.display = 'none';
    }

    openNewBookingModal() {
        if (this.selectedDate) {
            this.app.openBookingModal(this.selectedDate, null);
        } else {
            alert('Por favor, selecione um dia primeiro.');
        }
    }

    refresh() {
        this.renderCalendar();
        if (this.selectedDate) {
            this.renderDayAgendamentos(this.selectedDate);
            this.renderTimeSlots(this.selectedDate);
        }
    }
}

// Exportar para uso global
window.CalendarManager = CalendarManager;