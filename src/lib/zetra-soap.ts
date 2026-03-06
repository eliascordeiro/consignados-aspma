import * as soap from 'soap';

const ZETRA_WSDL = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';

export const ZETRA_CREDENTIALS = {
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
};

export interface ZetraConsultarMargemParams {
  matricula: string;
  cpf: string;
  valorParcela: string;
}

export interface ZetraReservarMargemParams {
  matricula: string;
  cpf: string;
  valorParcela: string;
  valorLiberado: string;
  prazo: number;
  codVerba?: string;
  servicoCodigo?: string;
  adeIdentificador: string;
}

export interface ZetraExcluirReservaParams {
  matricula: string;
  cpf: string;
  numeroReserva: string;
}

export interface ZetraAlterarConsignacaoParams {
  matricula: string;
  cpf: string;
  numeroContrato: string;
  novaDataVencimento?: string;
  novoValorParcela?: string;
}

export interface ZetraResponse {
  sucesso: boolean | string;
  codRetorno: string;
  mensagem: string;
  [key: string]: any;
}

/**
 * Cria cliente SOAP e executa operação
 */
async function executarOperacaoSOAP<T>(
  operacao: string,
  params: any
): Promise<{ success: boolean; data?: any; error?: any; rawRequest?: string; rawResponse?: string }> {
  console.log(`🔵 [ZETRA SOAP] Operação: ${operacao}`);
  console.log('📋 [ZETRA SOAP] Parâmetros:', JSON.stringify(params, null, 2));

  try {
    // Criar cliente SOAP
    const client = await soap.createClientAsync(ZETRA_WSDL);

    console.log('📤 [ZETRA SOAP] Enviando requisição...');

    // Executar operação
    const [result, rawResponse, soapHeader, rawRequest] = await client[`${operacao}Async`](params);

    console.log('📥 [ZETRA SOAP] Resposta recebida');

    // Extrair resposta da operação
    const responseKey = `${operacao}Response`;
    const response: ZetraResponse = result?.[responseKey] || result;

    const sucesso = response?.sucesso === 'true' || response?.sucesso === true;
    const codRetorno = response?.codRetorno;
    const mensagem = response?.mensagem;

    if (!sucesso) {
      console.log(`❌ [ZETRA SOAP] Erro ${codRetorno}: ${mensagem}`);
      return {
        success: false,
        error: {
          code: codRetorno,
          message: mensagem,
        },
        rawRequest,
        rawResponse,
      };
    }

    console.log(`✅ [ZETRA SOAP] Sucesso: ${mensagem || 'OK'}`);

    return {
      success: true,
      data: response,
      rawRequest,
      rawResponse,
    };
  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.code === 23 || error?.message?.includes('timeout');
    console.error(`❌ [ZETRA SOAP] ${isTimeout ? 'TIMEOUT' : 'ERRO'}:`, error.message);

    return {
      success: false,
      error: {
        message: error.message,
        isTimeout,
        stack: error.stack,
      },
    };
  }
}

/**
 * Consultar margem disponível
 */
export async function consultarMargem(params: ZetraConsultarMargemParams) {
  const args = {
    ...ZETRA_CREDENTIALS,
    matricula: params.matricula,
    cpf: params.cpf,
    valorParcela: params.valorParcela,
  };

  return executarOperacaoSOAP('consultarMargem', args);
}

/**
 * Reservar margem
 */
export async function reservarMargem(params: ZetraReservarMargemParams) {
  const args = {
    ...ZETRA_CREDENTIALS,
    matricula: params.matricula,
    cpf: params.cpf,
    valorParcela: params.valorParcela,
    valorLiberado: params.valorLiberado,
    prazo: params.prazo,
    codVerba: params.codVerba ||'441',
    servicoCodigo: params.servicoCodigo || '018',
    adeIdentificador: params.adeIdentificador,
  };

  return executarOperacaoSOAP('reservarMargem', args);
}

/**
 * Excluir reserva de margem
 */
export async function excluirReserva(params: ZetraExcluirReservaParams) {
  const args = {
    ...ZETRA_CREDENTIALS,
    matricula: params.matricula,
    cpf: params.cpf,
    numeroReserva: params.numeroReserva,
  };

  return executarOperacaoSOAP('excluirReserva', args);
}

/**
 * Alterar dados de consignação
 */
export async function alterarConsignacao(params: ZetraAlterarConsignacaoParams) {
  const args = {
    ...ZETRA_CREDENTIALS,
    matricula: params.matricula,
    cpf: params.cpf,
    numeroContrato: params.numeroContrato,
    ...(params.novaDataVencimento && { novaDataVencimento: params.novaDataVencimento }),
    ...(params.novoValorParcela && { novoValorParcela: params.novoValorParcela }),
  };

  return executarOperacaoSOAP('alterarConsignacao', args);
}

/**
 * Formatar CPF (adicionar pontos e hífen)
 */
export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}
