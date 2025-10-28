// =============================================
// GERENCIAMENTO DE CLIENTES
// =============================================

class ClientsManager {
    constructor(app) {
        this.app = app;
        this.editingClientId = null;
        this.clientSort = { column: 'name', direction: 'asc' };
        this.cpfValidationState = { validated: false, valid: false };
        
        // NOVO: Estado para controle de duplicatas
        this.pendingClientData = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMasks();
    }

    setupEventListeners() {
        // Formulário de cliente
        document.getElementById('client-form').addEventListener('submit', (e) => this.handleClientSubmit(e));
        document.getElementById('client-cancel-btn').addEventListener('click', () => this.resetClientForm());
        
        // Ordenação e exportação
        document.getElementById('apply-client-sort').addEventListener('click', () => this.applyClientSort());
        document.getElementById('export-clients').addEventListener('click', () => this.exportClients());
        
        // Validação de CPF e busca de CEP
        document.getElementById('validate-cpf').addEventListener('click', () => this.validateCPF());
        document.getElementById('search-cep').addEventListener('click', () => this.searchCEP());
        
        // Mudança de tipo de documento
        document.getElementById('client-type').addEventListener('change', () => this.handleDocumentTypeChange());
        
        // Enter no campo CEP
        document.getElementById('client-cep').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchCEP();
            }
        });

        // NOVO: Event listeners para o modal de duplicatas
        document.getElementById('use-existing-client-btn').addEventListener('click', () => this.useExistingClient());
        document.getElementById('edit-existing-client-btn').addEventListener('click', () => this.editExistingClient());
        document.getElementById('continue-new-client-btn').addEventListener('click', () => this.continueNewClient());
    }

    setupMasks() {
        // Máscara para documento
        document.getElementById('client-document').addEventListener('input', (e) => this.handleDocumentInput(e));
        
        // Máscara para telefone
        document.getElementById('client-phone').addEventListener('input', (e) => this.handlePhoneInput(e));
        
        // Máscara para CEP
        document.getElementById('client-cep').addEventListener('input', (e) => this.handleCEPInput(e));
    }

    // NOVO: Método principal de verificação de duplicatas
    async checkForDuplicates(clientData, currentClientId = null) {
        const similarClients = Utils.findSimilarClients(this.app.clients, clientData, currentClientId);
        const sortedResults = Utils.sortSimilarityResults(similarClients);
        
        // Se não encontrou nenhum similar, retorna null
        if (sortedResults.length === 0) {
            return null;
        }

        return {
            exactMatches: similarClients.exactMatches,
            allMatches: sortedResults,
            hasExactMatch: similarClients.exactMatches.length > 0
        };
    }

    // NOVO: Mostrar modal de duplicatas
    showDuplicateAlert(duplicateResults, clientData) {
        // Guarda os dados do cliente pendente
        this.pendingClientData = clientData;
        this.duplicateResults = duplicateResults;

        const modal = document.getElementById('duplicate-alert-modal');
        const clientList = document.getElementById('duplicate-clients-list');
        
        // Limpa lista anterior
        clientList.innerHTML = '';

        // Adiciona cada cliente similar à lista
        duplicateResults.allMatches.forEach((client, index) => {
            const clientElement = document.createElement('div');
            clientElement.className = 'duplicate-client-item';
            clientElement.innerHTML = `
                <div class="client-info">
                    <strong>${client.artisticName}</strong>
                    <div class="client-details">
                        ${client.document ? `CPF/CNPJ: ${client.document}` : ''}
                        ${client.phone ? ` | Tel: ${client.phone}` : ''}
                    </div>
                    <div class="match-type ${client.matchType}">
                        ${this.getMatchTypeText(client.matchType)}
                    </div>
                </div>
            `;
            clientList.appendChild(clientElement);
        });

        // Atualiza mensagem baseada no tipo de match
        const messageElement = document.getElementById('duplicate-alert-message');
        if (duplicateResults.hasExactMatch) {
            messageElement.innerHTML = '<strong>⚠️ CPF/CNPJ Já Cadastrado!</strong><br>Encontramos clientes com o mesmo documento.';
        } else {
            messageElement.innerHTML = '<strong>🔍 Clientes Similares Encontrados</strong><br>Verifique se não é a mesma pessoa:';
        }

        // Mostra o modal
        modal.classList.add('active');
    }

    // NOVO: Texto descritivo para tipos de match
    getMatchTypeText(matchType) {
        const types = {
            'cpf_exato': 'CPF/CNPJ idêntico',
            'telefone_igual': 'Telefone igual', 
            'nome_similar': 'Nome similar',
            'cpf_similar': 'CPF similar'
        };
        return types[matchType] || 'Similar';
    }

    // NOVO: Usar cliente existente (fecha formulário)
    useExistingClient() {
        this.closeDuplicateModal();
        this.resetClientForm();
        this.showClientAlert('Operação cancelada. Cliente já existe no sistema.', 'info');
    }

    // NOVO: Editar cliente existente
    editExistingClient() {
        if (this.duplicateResults.allMatches.length > 0) {
            const firstClient = this.duplicateResults.allMatches[0];
            this.closeDuplicateModal();
            this.resetClientForm();
            this.editClient(firstClient.id);
        }
    }

    // NOVO: Continuar com novo cadastro (sobrescrever/ignorar)
    continueNewClient() {
        this.closeDuplicateModal();
        // Prossegue com o cadastro original
        this.processClientSubmit(this.pendingClientData);
    }

    // NOVO: Fechar modal de duplicatas
    closeDuplicateModal() {
        document.getElementById('duplicate-alert-modal').classList.remove('active');
        this.pendingClientData = null;
        this.duplicateResults = null;
    }

    // MODIFICADO: Agora verifica duplicatas antes de salvar
    async handleClientSubmit(e) {
        e.preventDefault();
        
        const clientData = this.getFormData();
        
        // Validações básicas
        if (!this.validateForm(clientData)) {
            return;
        }

        // Verifica duplicatas (exceto se estiver editando o mesmo cliente)
        const duplicateResults = await this.checkForDuplicates(clientData, this.editingClientId);
        
        if (duplicateResults && duplicateResults.allMatches.length > 0) {
            // Mostra modal de duplicatas
            this.showDuplicateAlert(duplicateResults, clientData);
        } else {
            // Não encontrou duplicatas, prossegue normalmente
            this.processClientSubmit(clientData);
        }
    }

    // NOVO: Extrai dados do formulário
    getFormData() {
        return {
            type: document.getElementById('client-type').value,
            document: document.getElementById('client-document').value,
            fullName: document.getElementById('client-fullname').value,
            artisticName: document.getElementById('client-name').value,
            phone: document.getElementById('client-phone').value,
            email: document.getElementById('client-email').value,
            notes: document.getElementById('client-notes').value,
            address: {
                cep: document.getElementById('client-cep').value,
                street: document.getElementById('client-street').value,
                number: document.getElementById('client-number').value,
                neighborhood: document.getElementById('client-neighborhood').value,
                complement: document.getElementById('client-complement').value,
                city: document.getElementById('client-city').value,
                state: document.getElementById('client-state').value
            }
        };
    }

    // NOVO: Validação do formulário
    validateForm(clientData) {
        const { document, fullName, artisticName, phone } = clientData;
        
        if (!document || !fullName || !artisticName || !phone) {
            this.showClientAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return false;
        }
        
        if (!this.validateDocument()) {
            this.showClientAlert('Por favor, digite um documento válido.', 'error');
            return false;
        }
        
        // Validação extra para CPF
        if (clientData.type === 'cpf' && this.cpfValidationState.validated && !this.cpfValidationState.valid) {
            const proceed = confirm('Este CPF foi considerado inválido. Deseja continuar mesmo assim?');
            if (!proceed) {
                return false;
            }
        }
        
        return true;
    }

    // MODIFICADO: Processamento final do cadastro (separado da validação)
    async processClientSubmit(clientData) {
        const clientId = document.getElementById('client-id').value;
        
        if (clientId) {
            // Atualiza o cliente existente
            await this.updateExistingClient(clientId, clientData);
        } else {
            // Cria um novo cliente
            await this.createNewClient(clientData);
        }
        
        this.renderClientsList();
        this.updateClientStats();
    }

    // NOVO: Atualizar cliente existente
    async updateExistingClient(clientId, clientData) {
        const clientIndex = this.app.clients.findIndex(c => c.id === clientId);
        if (clientIndex !== -1) {
            const oldClient = this.app.clients[clientIndex];
            const updatedClient = {
                ...oldClient,
                ...clientData,
                updatedAt: new Date().toISOString()
            };
            
            this.app.clients[clientIndex] = updatedClient;
            await this.app.firebaseSync.saveClient(updatedClient);
            
            this.app.logAction('update', 'client', clientId, {
                artisticName: clientData.artisticName,
                document: clientData.document,
                oldName: oldClient.artisticName
            });
            
            this.showClientAlert('Cliente atualizado com sucesso!', 'success');
        }
    }

    // NOVO: Criar novo cliente
    async createNewClient(clientData) {
        const client = {
            id: Utils.generateId(),
            ...clientData,
            totalHours: 0,
            totalSessions: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.app.clients.push(client);
        await this.app.firebaseSync.saveClient(client);
        
        this.app.logAction('create', 'client', client.id, {
            artisticName: clientData.artisticName,
            document: clientData.document
        });
        
        this.showClientAlert('Cliente cadastrado com sucesso!', 'success');
        this.resetClientForm();
    }

    // MÉTODOS EXISTENTES (mantidos intactos)
    handleDocumentInput(e) {
        const type = document.getElementById('client-type').value;
        let value = e.target.value.replace(/\D/g, '');
        
        if (type === 'cpf') {
            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            }
        } else {
            if (value.length <= 14) {
                value = value.replace(/(\d{2})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1/$2');
                value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            }
        }
        
        e.target.value = value;
        this.clearValidationStatus();
        
        if (type === 'cpf' && value.replace(/\D/g, '').length === 11) {
            document.getElementById('validate-cpf').style.display = 'block';
        } else {
            document.getElementById('validate-cpf').style.display = 'none';
        }
        
        this.validateDocument();
    }

    handlePhoneInput(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length <= 11) {
            if (value.length <= 10) {
                value = value.replace(/(\d{2})(\d)/, '($1) $2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
            } else {
                value = value.replace(/(\d{2})(\d)/, '($1) $2');
                value = value.replace(/(\d{5})(\d)/, '$1-$2');
            }
        }
        
        e.target.value = value;
    }

    handleCEPInput(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length <= 8) {
            if (value.length > 5) {
                value = value.replace(/(\d{5})(\d)/, '$1-$2');
            }
        }
        
        e.target.value = value;
    }

    handleDocumentTypeChange() {
        const documentInput = document.getElementById('client-document');
        documentInput.value = '';
        documentInput.placeholder = document.getElementById('client-type').value === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00';
        document.getElementById('document-error').style.display = 'none';
        documentInput.style.borderColor = 'var(--border-color)';
        document.getElementById('validate-cpf').style.display = 'none';
        this.clearValidationStatus();
    }

    async validateCPF() {
        const cpf = document.getElementById('client-document').value.replace(/\D/g, '');
        if (cpf.length === 11) {
            const result = await this.validateCPFAndGetName(cpf);
            if (result.valid) {
                document.getElementById('client-fullname').focus();
            }
        } else {
            this.showClientAlert('Por favor, digite um CPF válido com 11 dígitos.', 'error');
        }
    }

    async validateCPFAndGetName(cpf) {
        try {
            cpf = cpf.replace(/\D/g, '');
            
            if (cpf.length !== 11) {
                throw new Error('CPF deve ter 11 dígitos');
            }
            
            document.getElementById('validate-cpf').textContent = 'Validando...';
            document.getElementById('validate-cpf').classList.add('loading');
            
            const isValid = Utils.advancedCPFValidation(cpf);
            
            this.cpfValidationState.validated = true;
            this.cpfValidationState.valid = isValid;
            
            if (isValid) {
                this.showValidationStatus('CPF válido', true);
                this.showClientAlert('CPF válido! Agora preencha os dados do cliente.', 'success');
                return { valid: true, name: '' };
            } else {
                this.showValidationStatus('CPF inválido', false);
                throw new Error('CPF inválido');
            }
            
        } catch (error) {
            console.error('Erro na validação do CPF:', error);
            this.showValidationStatus('CPF inválido', false);
            this.showClientAlert(`Erro na validação: ${error.message}`, 'error');
            return { valid: false, name: '' };
        } finally {
            document.getElementById('validate-cpf').textContent = 'Validar CPF';
            document.getElementById('validate-cpf').classList.remove('loading');
        }
    }

    async searchCEP() {
        const cep = document.getElementById('client-cep').value.replace(/\D/g, '');
        if (cep.length === 8) {
            await this.searchAddressByCEP(cep);
        } else {
            this.showClientAlert('Por favor, digite um CEP válido com 8 dígitos.', 'error');
        }
    }

    async searchAddressByCEP(cep) {
        try {
            cep = cep.replace(/\D/g, '');
            
            if (cep.length !== 8) {
                throw new Error('CEP deve ter 8 dígitos');
            }
            
            document.getElementById('search-cep').textContent = 'Buscando...';
            document.getElementById('search-cep').classList.add('loading');
            
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
            
            if (!response.ok) {
                throw new Error('CEP não encontrado');
            }
            
            const address = await response.json();
            
            document.getElementById('client-street').value = address.street || '';
            document.getElementById('client-neighborhood').value = address.neighborhood || '';
            document.getElementById('client-city').value = address.city || '';
            document.getElementById('client-state').value = address.state || '';
            document.getElementById('client-number').focus();
            
            return address;
        } catch (error) {
            console.error('Erro na busca do CEP:', error);
            this.showClientAlert(`Erro ao buscar CEP: ${error.message}`, 'error');
            return null;
        } finally {
            document.getElementById('search-cep').textContent = 'Buscar CEP';
            document.getElementById('search-cep').classList.remove('loading');
        }
    }

    showValidationStatus(message, isValid) {
        const validationStatus = document.getElementById('validation-status');
        validationStatus.textContent = message;
        validationStatus.className = 'validation-status';
        validationStatus.classList.add(isValid ? 'validation-valid' : 'validation-invalid');
        validationStatus.style.display = 'block';
    }

    clearValidationStatus() {
        const validationStatus = document.getElementById('validation-status');
        validationStatus.style.display = 'none';
        this.cpfValidationState.validated = false;
        this.cpfValidationState.valid = false;
    }

    showClientAlert(message, type) {
        const alert = document.getElementById('client-alert');
        alert.textContent = message;
        alert.className = `alert alert-${type}`;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }

    resetClientForm() {
        document.getElementById('client-form').reset();
        document.getElementById('client-id').value = '';
        document.getElementById('client-submit-btn').textContent = 'Cadastrar Cliente';
        document.getElementById('client-cancel-btn').style.display = 'none';
        this.editingClientId = null;
        document.getElementById('document-error').style.display = 'none';
        document.getElementById('client-document').style.borderColor = 'var(--border-color)';
        document.getElementById('validate-cpf').style.display = 'none';
        this.clearValidationStatus();
        
        document.getElementById('client-street').value = '';
        document.getElementById('client-number').value = '';
        document.getElementById('client-neighborhood').value = '';
        document.getElementById('client-complement').value = '';
        document.getElementById('client-city').value = '';
        document.getElementById('client-state').value = '';
        
        document.getElementById('client-document').focus();
    }

    renderClientsList() {
        const clientsList = document.getElementById('clients-list');
        clientsList.innerHTML = '';
        
        if (this.app.clients.length === 0) {
            clientsList.innerHTML = '<p>Nenhum cliente cadastrado ainda.</p>';
            return;
        }
        
        // Calcula estatísticas para cada cliente
        const clientsWithStats = this.app.clients.map(client => {
            const clientBookings = this.app.bookings.filter(booking => booking.clientId === client.id);
            const totalHours = clientBookings.reduce((sum, booking) => sum + booking.duration, 0);
            const totalSessions = clientBookings.length;
            
            return {
                ...client,
                totalHours,
                totalSessions,
                lastBooking: clientBookings.length > 0 ? 
                    Math.max(...clientBookings.map(b => new Date(b.date).getTime())) : 0
            };
        });
        
        // Aplica ordenação
        clientsWithStats.sort((a, b) => {
            const multiplier = this.clientSort.direction === 'asc' ? 1 : -1;
            
            if (this.clientSort.column === 'name') {
                return multiplier * a.artisticName.localeCompare(b.artisticName);
            } else if (this.clientSort.column === 'hours') {
                return multiplier * (a.totalHours - b.totalHours);
            } else if (this.clientSort.column === 'sessions') {
                return multiplier * (a.totalSessions - b.totalSessions);
            } else if (this.clientSort.column === 'recent') {
                return multiplier * (a.lastBooking - b.lastBooking);
            }
            
            return 0;
        });
        
        clientsWithStats.forEach(client => {
            const clientElement = document.createElement('div');
            clientElement.classList.add('booking-item');
            
            const whatsappLink = `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(client.artisticName)}! Tudo bem?`;
            
            let addressInfo = '';
            if (client.address && (client.address.street || client.address.city)) {
                addressInfo = `
                    <p><strong>Endereço:</strong> 
                    ${client.address.street || ''} ${client.address.number || ''}
                    ${client.address.complement ? `, ${client.address.complement}` : ''}
                    ${client.address.neighborhood ? `, ${client.address.neighborhood}` : ''}
                    ${client.address.city ? ` - ${client.address.city}` : ''}
                    ${client.address.state ? `/ ${client.address.state}` : ''}
                    ${client.address.cep ? ` - CEP: ${client.address.cep}` : ''}
                    </p>
                `;
            }
            
            clientElement.innerHTML = `
                <div class="booking-info">
                    <h3>${client.artisticName}</h3>
                    <p><strong>Nome Completo:</strong> ${client.fullName}</p>
                    <p>${client.type.toUpperCase()}: ${client.document}</p>
                    <p>Telefone: <a href="${whatsappLink}" target="_blank" class="whatsapp-link">${client.phone}</a></p>
                    ${client.email ? `<p>E-mail: ${client.email}</p>` : ''}
                    ${addressInfo}
                    <p><strong>Horas totais:</strong> ${client.totalHours}h | <strong>Sessões:</strong> ${client.totalSessions}</p>
                    ${client.notes ? `<p><strong>Observações:</strong> ${client.notes}</p>` : ''}
                </div>
                <div class="booking-actions">
                    <button class="btn btn-warning" onclick="app.editClient('${client.id}')">Editar</button>
                    <button class="btn btn-error" onclick="app.deleteClient('${client.id}')">Excluir</button>
                </div>
            `;
            clientsList.appendChild(clientElement);
        });
    }

    applyClientSort() {
        const sortValue = document.getElementById('sort-clients').value;
        this.clientSort.column = sortValue;
        this.renderClientsList();
    }

    updateClientStats() {
        const totalClients = this.app.clients.length;
        const clientsWithBookings = this.app.clients.filter(client => 
            this.app.bookings.some(booking => booking.clientId === client.id)
        );
        const totalHours = this.app.bookings.reduce((sum, booking) => sum + booking.duration, 0);
        
        document.getElementById('total-clients').textContent = totalClients;
        document.getElementById('active-clients').textContent = clientsWithBookings.length;
        document.getElementById('total-hours').textContent = `${totalHours}h`;
    }

    exportClients() {
        if (this.app.clients.length === 0) {
            alert('Não há clientes para exportar.');
            return;
        }
        
        const data = this.app.clients.map(client => {
            const clientBookings = this.app.bookings.filter(booking => booking.clientId === client.id);
            const totalHours = clientBookings.reduce((sum, booking) => sum + booking.duration, 0);
            const totalSessions = clientBookings.length;
            
            return {
                'Nome Artístico': client.artisticName,
                'Nome Completo': client.fullName,
                'Documento': client.document,
                'Telefone': client.phone,
                'E-mail': client.email || '',
                'CEP': client.address?.cep || '',
                'Endereço': client.address ? `${client.address.street || ''} ${client.address.number || ''}` : '',
                'Complemento': client.address?.complement || '',
                'Bairro': client.address?.neighborhood || '',
                'Cidade': client.address?.city || '',
                'Estado': client.address?.state || '',
                'Horas Totais': totalHours,
                'Total de Sessões': totalSessions,
                'Observações': client.notes || ''
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
        a.download = `clientes_catarse_studio_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('Lista de clientes exportada com sucesso!');
    }

    editClient(clientId) {
        const client = this.app.clients.find(c => c.id === clientId);
        if (client) {
            document.getElementById('client-id').value = client.id;
            document.getElementById('client-type').value = client.type;
            document.getElementById('client-document').value = client.document;
            document.getElementById('client-fullname').value = client.fullName;
            document.getElementById('client-name').value = client.artisticName;
            document.getElementById('client-phone').value = client.phone;
            document.getElementById('client-email').value = client.email || '';
            document.getElementById('client-notes').value = client.notes || '';
            
            if (client.address) {
                document.getElementById('client-cep').value = client.address.cep || '';
                document.getElementById('client-street').value = client.address.street || '';
                document.getElementById('client-number').value = client.address.number || '';
                document.getElementById('client-neighborhood').value = client.address.neighborhood || '';
                document.getElementById('client-complement').value = client.address.complement || '';
                document.getElementById('client-city').value = client.address.city || '';
                document.getElementById('client-state').value = client.address.state || '';
            }
            
            document.getElementById('client-submit-btn').textContent = 'Atualizar Cliente';
            document.getElementById('client-cancel-btn').style.display = 'inline-block';
            this.editingClientId = clientId;
            
            if (client.type === 'cpf' && client.document.replace(/\D/g, '').length === 11) {
                document.getElementById('validate-cpf').style.display = 'block';
            } else {
                document.getElementById('validate-cpf').style.display = 'none';
            }
            
            document.getElementById('clients').scrollTop = 0;
        }
    }

    async deleteClient(clientId) {
        if (confirm('Tem certeza que deseja excluir este cliente?')) {
            const clientBookings = this.app.bookings.filter(booking => 
                booking.clientId === clientId && 
                new Date(booking.date) >= new Date()
            );
            
            if (clientBookings.length > 0) {
                alert('Não é possível excluir este cliente pois existem agendamentos futuros vinculados a ele.');
                return;
            }
            
            const client = this.app.clients.find(c => c.id === clientId);
            this.app.clients = this.app.clients.filter(client => client.id !== clientId);
            
            await this.app.firebaseSync.deleteClient(clientId);
            
            this.app.logAction('delete', 'client', clientId, {
                name: client.artisticName,
                document: client.document
            });
            
            this.renderClientsList();
            this.updateClientStats();
            alert('Cliente excluído com sucesso!');
        }
    }

    validateDocument() {
        const documentInput = document.getElementById('client-document');
        const errorElement = document.getElementById('document-error');
        const type = document.getElementById('client-type').value;
        const documentValue = documentInput.value.replace(/\D/g, '');
        
        let isValid = false;
        
        if (type === 'cpf') {
            isValid = documentValue.length === 11 && Utils.validateCPF(documentValue);
        } else {
            isValid = documentValue.length === 14 && Utils.validateCNPJ(documentValue);
        }
        
        if (documentValue.length > 0 && !isValid) {
            errorElement.style.display = 'block';
            documentInput.style.borderColor = 'var(--error-color)';
        } else {
            errorElement.style.display = 'none';
            documentInput.style.borderColor = 'var(--border-color)';
        }
        
        return isValid;
    }
}

// Exportar para uso global
window.ClientsManager = ClientsManager;
