// =============================================
// GERENCIAMENTO DE SERVIÇOS
// =============================================

class ServicesManager {
    constructor(app) {
        this.app = app;
        this.editingServiceId = null;
        this.services = JSON.parse(localStorage.getItem('studio_services')) || [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDefaultServices();
        this.renderServicesList();
    }

    setupEventListeners() {
        // Formulário de serviço
        document.getElementById('service-form').addEventListener('submit', (e) => this.handleServiceSubmit(e));
        document.getElementById('service-cancel-btn').addEventListener('click', () => this.resetServiceForm());
    }

    loadDefaultServices() {
        if (this.services.length === 0) {
            console.log('📦 Carregando serviços padrão...');
            this.services = [
                {
                    id: Utils.generateId(),
                    name: "Ensaio",
                    pricePerHour: 100,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: Utils.generateId(),
                    name: "Gravação", 
                    pricePerHour: 150,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: Utils.generateId(),
                    name: "Mixagem",
                    pricePerHour: 120,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: Utils.generateId(),
                    name: "Masterização",
                    pricePerHour: 80,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: Utils.generateId(),
                    name: "Vídeo",
                    pricePerHour: 200,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];
            this.saveServices();
            console.log('✅ Serviços padrão cadastrados:', this.services.length);
        }
    }

    async handleServiceSubmit(e) {
        e.preventDefault();
        
        const serviceData = {
            name: document.getElementById('service-name').value.trim(),
            pricePerHour: parseFloat(document.getElementById('service-price').value)
        };

        if (!this.validateService(serviceData)) {
            return;
        }

        const serviceId = document.getElementById('service-id').value;
        
        if (serviceId) {
            await this.updateService(serviceId, serviceData);
        } else {
            await this.createService(serviceData);
        }

        this.renderServicesList();
        this.resetServiceForm();
    }

    validateService(serviceData) {
        if (!serviceData.name || serviceData.name.length < 2) {
            this.showServiceAlert('Por favor, digite um nome válido para o serviço (mínimo 2 caracteres).', 'error');
            return false;
        }

        if (!serviceData.pricePerHour || serviceData.pricePerHour <= 0) {
            this.showServiceAlert('Por favor, digite um valor válido para o serviço (maior que zero).', 'error');
            return false;
        }

        // Verifica se já existe serviço com mesmo nome (exceto na edição)
        const existingService = this.services.find(service => 
            service.name.toLowerCase() === serviceData.name.toLowerCase() &&
            service.id !== this.editingServiceId
        );

        if (existingService) {
            this.showServiceAlert('Já existe um serviço com este nome. Por favor, escolha outro nome.', 'error');
            return false;
        }

        return true;
    }

    async createService(serviceData) {
        const service = {
            id: Utils.generateId(),
            ...serviceData,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.services.push(service);
        await this.saveServices();

        this.app.logAction('create', 'service', service.id, {
            name: service.name,
            pricePerHour: service.pricePerHour
        });

        this.showServiceAlert('Serviço cadastrado com sucesso!', 'success');
        console.log('✅ Novo serviço criado:', service.name);
    }

    async updateService(serviceId, serviceData) {
        const serviceIndex = this.services.findIndex(s => s.id === serviceId);
        if (serviceIndex !== -1) {
            const oldService = this.services[serviceIndex];
            const updatedService = {
                ...oldService,
                ...serviceData,
                updatedAt: new Date().toISOString()
            };

            this.services[serviceIndex] = updatedService;
            await this.saveServices();

            this.app.logAction('update', 'service', serviceId, {
                name: serviceData.name,
                pricePerHour: serviceData.pricePerHour,
                oldName: oldService.name,
                oldPrice: oldService.pricePerHour
            });

            this.showServiceAlert('Serviço atualizado com sucesso!', 'success');
            console.log('✅ Serviço atualizado:', serviceData.name);
        }
    }

    async deleteService(serviceId) {
        const service = this.services.find(s => s.id === serviceId);
        if (!service) return;

        // Verificar se o serviço está sendo usado em agendamentos futuros
        const futureBookings = this.app.bookings.filter(booking => {
            if (booking.services && booking.services.length > 0) {
                return booking.services.some(s => s.serviceId === serviceId) && 
                       new Date(booking.date) >= new Date();
            }
            return false;
        });

        if (futureBookings.length > 0) {
            this.showServiceAlert(
                `Não é possível excluir este serviço pois existem ${futureBookings.length} agendamento(s) futuro(s) vinculado(s) a ele.`,
                'error'
            );
            return;
        }

        if (confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
            this.services = this.services.filter(s => s.id !== serviceId);
            
            await this.saveServices();

            this.app.logAction('delete', 'service', serviceId, {
                name: service.name,
                pricePerHour: service.pricePerHour
            });

            this.renderServicesList();
            this.showServiceAlert('Serviço excluído com sucesso!', 'success');
            console.log('🗑️ Serviço excluído:', service.name);
        }
    }

    toggleService(serviceId) {
        const serviceIndex = this.services.findIndex(s => s.id === serviceId);
        if (serviceIndex !== -1) {
            const oldStatus = this.services[serviceIndex].enabled;
            this.services[serviceIndex].enabled = !oldStatus;
            this.services[serviceIndex].updatedAt = new Date().toISOString();
            
            this.saveServices();
            this.renderServicesList();
            
            const action = oldStatus ? 'desativado' : 'ativado';
            this.showServiceAlert(`Serviço ${action} com sucesso!`, 'success');
            console.log(`🔄 Serviço ${action}:`, this.services[serviceIndex].name);
        }
    }

    editService(serviceId) {
        const service = this.services.find(s => s.id === serviceId);
        if (service) {
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-name').value = service.name;
            document.getElementById('service-price').value = service.pricePerHour;
            
            document.getElementById('service-submit-btn').textContent = 'Atualizar Serviço';
            document.getElementById('service-cancel-btn').style.display = 'inline-block';
            this.editingServiceId = serviceId;
            
            // Scroll para o topo do formulário
            document.getElementById('service-name').focus();
            document.getElementById('services').scrollTo({ top: 0, behavior: 'smooth' });
            
            console.log('✏️ Editando serviço:', service.name);
        }
    }

    renderServicesList() {
        const servicesList = document.getElementById('services-list');
        servicesList.innerHTML = '';

        if (this.services.length === 0) {
            servicesList.innerHTML = '<div class="booking-item"><p>Nenhum serviço cadastrado.</p></div>';
            return;
        }

        // Ordena serviços por nome
        const sortedServices = [...this.services].sort((a, b) => a.name.localeCompare(b.name));

        sortedServices.forEach(service => {
            const serviceElement = document.createElement('div');
            serviceElement.classList.add('booking-item', service.enabled ? 'service-enabled' : 'service-disabled');
            
            const createdAt = new Date(service.createdAt).toLocaleDateString('pt-BR');
            const updatedAt = new Date(service.updatedAt).toLocaleDateString('pt-BR');
            
            serviceElement.innerHTML = `
                <div class="booking-info">
                    <h3>${service.name}</h3>
                    <p><strong>Valor por hora:</strong> R$ ${service.pricePerHour.toFixed(2)}</p>
                    <p><strong>Status:</strong> ${service.enabled ? '✅ Ativo' : '❌ Inativo'}</p>
                    <p><strong>Cadastrado em:</strong> ${createdAt}</p>
                    <p><strong>Última atualização:</strong> ${updatedAt}</p>
                </div>
                <div class="booking-actions">
                    <button class="btn btn-warning" onclick="app.editService('${service.id}')">Editar</button>
                    <button class="btn ${service.enabled ? 'btn-secondary' : 'btn-success'}" onclick="app.toggleService('${service.id}')">
                        ${service.enabled ? 'Desativar' : 'Ativar'}
                    </button>
                    <button class="btn btn-error" onclick="app.deleteService('${service.id}')">Excluir</button>
                </div>
            `;
            servicesList.appendChild(serviceElement);
        });
    }

    resetServiceForm() {
        document.getElementById('service-form').reset();
        document.getElementById('service-id').value = '';
        document.getElementById('service-submit-btn').textContent = 'Cadastrar Serviço';
        document.getElementById('service-cancel-btn').style.display = 'none';
        this.editingServiceId = null;
        
        // Foca no primeiro campo
        document.getElementById('service-name').focus();
    }

    showServiceAlert(message, type) {
        const alert = document.getElementById('services-alert');
        alert.textContent = message;
        alert.className = `alert alert-${type}`;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }

    async saveServices() {
        // Salva localmente
        localStorage.setItem('studio_services', JSON.stringify(this.services));
        
        // Sincroniza com Firebase se disponível
        if (this.app.firebaseSync) {
            try {
                for (const service of this.services) {
                    await this.app.firebaseSync.saveService(service);
                }
                console.log('✅ Serviços sincronizados com Firebase');
            } catch (error) {
                console.error('❌ Erro ao sincronizar serviços com Firebase:', error);
            }
        }
    }

    getEnabledServices() {
        return this.services.filter(service => service.enabled);
    }

    getServiceById(serviceId) {
        return this.services.find(service => service.id === serviceId);
    }

    getServiceByName(serviceName) {
        return this.services.find(service => 
            service.name.toLowerCase() === serviceName.toLowerCase()
        );
    }
}

// Exportar para uso global
window.ServicesManager = ServicesManager;
