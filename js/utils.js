// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================

class Utils {
    // Formatação de documentos
    static formatCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    static formatCNPJ(cnpj) {
        cnpj = cnpj.replace(/\D/g, '');
        return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    static formatPhone(phone) {
        phone = phone.replace(/\D/g, '');
        if (phone.length === 11) {
            return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        }
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }

    static formatCEP(cep) {
        cep = cep.replace(/\D/g, '');
        return cpf.replace(/(\d{5})(\d{3})/, "$1-$2");
    }

    // NOVAS FUNÇÕES PARA CONTROLE DE DUPLICATAS
    /**
     * Remove toda formatação do documento (CPF/CNPJ)
     */
    static cleanDocument(document) {
        return document.replace(/\D/g, '');
    }

    /**
     * Normaliza telefone para comparação (remove formatação)
     */
    static normalizePhone(phone) {
        return phone.replace(/\D/g, '').substring(0, 11);
    }

    /**
     * Calcula similaridade entre dois nomes (0 a 1)
     */
    static calculateNameSimilarity(name1, name2) {
        if (!name1 || !name2) return 0;
        
        const str1 = name1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const str2 = name2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Verifica se um nome contém o outro
        if (str1.includes(str2) || str2.includes(str1)) return 0.8;
        
        // Calcula similaridade por diferença de caracteres
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length);
    }

    /**
     * Algoritmo de distância de edição (Levenshtein)
     */
    static editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    /**
     * Busca clientes similares baseado em múltiplos critérios
     */
    static findSimilarClients(existingClients, newClient, currentClientId = null) {
        const cleanNewDocument = this.cleanDocument(newClient.document);
        const cleanNewPhone = this.normalizePhone(newClient.phone);
        const newName = newClient.artisticName || newClient.fullName;
        
        const results = {
            exactMatches: [],        // CPF exatamente igual
            similarDocuments: [],    // CPF similar (diferença de 1-2 dígitos)
            similarPhones: [],       // Telefones iguais ou muito similares
            similarNames: []         // Nomes muito similares (> 70% similaridade)
        };

        existingClients.forEach(client => {
            // Pular o cliente atual em caso de edição
            if (client.id === currentClientId) return;

            const cleanExistingDocument = this.cleanDocument(client.document);
            const cleanExistingPhone = this.normalizePhone(client.phone);
            const existingName = client.artisticName || client.fullName;

            // 1. CPF EXATAMENTE IGUAL
            if (cleanNewDocument && cleanNewDocument === cleanExistingDocument) {
                results.exactMatches.push({
                    ...client,
                    matchType: 'cpf_exato',
                    confidence: 1.0
                });
                return; // Não precisa verificar outros critérios se CPF é igual
            }

            // 2. TELEFONE IGUAL
            if (cleanNewPhone && cleanNewPhone === cleanExistingPhone) {
                results.similarPhones.push({
                    ...client,
                    matchType: 'telefone_igual',
                    confidence: 0.9
                });
            }

            // 3. NOME SIMILAR (apenas se não encontrou por CPF/Telefone)
            if (newName && existingName) {
                const similarity = this.calculateNameSimilarity(newName, existingName);
                if (similarity > 0.7) {
                    results.similarNames.push({
                        ...client,
                        matchType: 'nome_similar',
                        confidence: similarity
                    });
                }
            }

            // 4. CPF SIMILAR (apenas para casos de digitação)
            if (cleanNewDocument && cleanExistingDocument && 
                cleanNewDocument.length === cleanExistingDocument.length) {
                let diffCount = 0;
                for (let i = 0; i < cleanNewDocument.length; i++) {
                    if (cleanNewDocument[i] !== cleanExistingDocument[i]) diffCount++;
                }
                if (diffCount <= 2 && diffCount > 0) {
                    results.similarDocuments.push({
                        ...client,
                        matchType: 'cpf_similar',
                        confidence: 1 - (diffCount / cleanNewDocument.length)
                    });
                }
            }
        });

        return results;
    }

    /**
     * Ordena resultados por confiança (mais relevantes primeiro)
     */
    static sortSimilarityResults(results) {
        const allResults = [
            ...results.exactMatches,
            ...results.similarPhones,
            ...results.similarDocuments, 
            ...results.similarNames
        ];

        return allResults.sort((a, b) => b.confidence - a.confidence);
    }

    // Validações (mantidas do código original)
    static validateCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
            return false;
        }
        
        let sum = 0;
        let remainder;
        
        for (let i = 1; i <= 9; i++) {
            sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
        }
        
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.substring(9, 10))) return false;
        
        sum = 0;
        for (let i = 1; i <= 10; i++) {
            sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
        }
        
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.substring(10, 11))) return false;
        
        return true;
    }

    static validateCNPJ(cnpj) {
        cnpj = cnpj.replace(/\D/g, '');
        
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
            return false;
        }
        
        let size = cnpj.length - 2;
        let numbers = cnpj.substring(0, size);
        let digits = cnpj.substring(size);
        let sum = 0;
        let pos = size - 7;
        
        for (let i = size; i >= 1; i--) {
            sum += numbers.charAt(size - i) * pos--;
            if (pos < 2) pos = 9;
        }
        
        let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
        if (result !== parseInt(digits.charAt(0))) return false;
        
        size = size + 1;
        numbers = cnpj.substring(0, size);
        sum = 0;
        pos = size - 7;
        
        for (let i = size; i >= 1; i--) {
            sum += numbers.charAt(size - i) * pos--;
            if (pos < 2) pos = 9;
        }
        
        result = sum % 11 < 2 ? 0 : 11 - sum % 11;
        if (result !== parseInt(digits.charAt(1))) return false;
        
        return true;
    }

    // Cálculo de horário final
    static calculateEndTime(startTime, duration) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const endHours = hours + duration;
        return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Formatação de data
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    // Geração de ID único
    static generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Validação avançada de CPF
    static advancedCPFValidation(cpf) {
        cpf = cpf.replace(/\D/g, '');
        
        if (cpf.length !== 11) {
            return false;
        }
        
        if (/^(\d)\1+$/.test(cpf)) {
            return false;
        }
        
        let sum = 0;
        let remainder;
        
        for (let i = 1; i <= 9; i++) {
            sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
        }
        
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.substring(9, 10))) return false;
        
        sum = 0;
        for (let i = 1; i <= 10; i++) {
            sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
        }
        
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.substring(10, 11))) return false;
        
        return true;
    }
}

// Exportar para uso global
window.Utils = Utils;
