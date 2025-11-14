export interface Address {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  formattedAddress: string;
}

export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

class AddressService {
  /**
   * Busca endereço por CEP usando a API ViaCEP
   */
  async searchByCEP(cep: string): Promise<Address | null> {
    try {
      // Remove formatação do CEP (deixa só números)
      const cleanCEP = cep.replace(/\D/g, '');

      if (cleanCEP.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar CEP. Verifique sua conexão.');
      }

      const data: ViaCEPResponse = await response.json();

      if (data.erro) {
        return null;
      }

      return {
        cep: data.cep,
        logradouro: data.logradouro,
        complemento: data.complemento,
        bairro: data.bairro,
        localidade: data.localidade,
        uf: data.uf,
        formattedAddress: this.formatAddress(data),
      };
    } catch (error: any) {
      console.error('Erro ao buscar CEP:', error);
      if (error.message === 'Network request failed') {
        throw new Error('Sem conexão com a internet');
      }
      throw error;
    }
  }

  /**
   * Busca CEP por endereço (busca reversa)
   */
  async searchByAddress(uf: string, city: string, street: string): Promise<Address[]> {
    try {
      if (!uf || !city || !street) {
        throw new Error('UF, cidade e logradouro são obrigatórios');
      }

      if (street.length < 3) {
        throw new Error('Logradouro deve ter pelo menos 3 caracteres');
      }

      const response = await fetch(
        `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar endereço. Verifique sua conexão.');
      }

      const data: ViaCEPResponse[] = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data.map((item) => ({
        cep: item.cep,
        logradouro: item.logradouro,
        complemento: item.complemento,
        bairro: item.bairro,
        localidade: item.localidade,
        uf: item.uf,
        formattedAddress: this.formatAddress(item),
      }));
    } catch (error: any) {
      console.error('Erro ao buscar endereço:', error);
      if (error.message === 'Network request failed') {
        throw new Error('Sem conexão com a internet');
      }
      throw error;
    }
  }

  /**
   * Formata endereço completo
   */
  private formatAddress(data: ViaCEPResponse): string {
    const parts = [
      data.logradouro,
      data.bairro,
      `${data.localidade}/${data.uf}`,
      data.cep,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Formata CEP (12345-678)
   */
  formatCEP(cep: string): string {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return cep;
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
}

export const addressService = new AddressService();
