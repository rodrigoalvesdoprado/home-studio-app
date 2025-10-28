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
        return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
    }

    // Validações
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
