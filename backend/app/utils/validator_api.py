"""
Módulo para validação de assinaturas PDF via API do ITI (sem Selenium).
Função principal: validate_pdf(pdf_path, verbose=False) → dict
"""

import json
import requests
from pathlib import Path


def validate_pdf(pdf_path, verbose=False):
    """
    Valida assinaturas de PDF usando API direta do ITI.
    Args:
        pdf_path: Caminho para o arquivo PDF
        verbose: Se True, mostra mensagens de progresso
    Returns:
        dict com resultado da validação
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    if verbose:
        print(f"\n{'='*60}")
        print(f"Validando: {pdf_path.name}")
        print(f"{'='*60}\n")

    url_arquivo = "https://validar.iti.gov.br/arquivo"
    headers = {
        'Referer': 'https://validar.iti.gov.br/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'Accept': '*/*',
        'Origin': 'https://validar.iti.gov.br',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
    }
    files = {
        'signature_files[]': (pdf_path.name, pdf_path.open('rb'), 'application/pdf')
    }

    if verbose:
        print("📤 Enviando PDF para /arquivo...")

    try:
        response = requests.post(url_arquivo, headers=headers, files=files, timeout=60)

        if verbose:
            print(f"   Status: {response.status_code}")

        if response.status_code == 400:
            return {
                "status": "invalid",
                "error": "Documento sem assinatura ou inválido",
                "details": response.json() if response.content else None
            }
        if response.status_code != 200:
            return {
                "status": "error",
                "error": f"Erro HTTP {response.status_code}",
                "details": response.text
            }
        json_bruto = response.json()

        if verbose:
            print(f"   ✓ Resposta recebida ({len(json.dumps(json_bruto))} bytes)")

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        files['signature_files[]'][1].close()

    if verbose:
        print("📥 Processando com /simples...")

    url_simples = "https://validar.iti.gov.br/simples"
    headers_simples = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Referer': 'https://validar.iti.gov.br/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'Origin': 'https://validar.iti.gov.br',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
    }
    try:
        response_simples = requests.post(
            url_simples,
            headers=headers_simples,
            json=json_bruto,
            timeout=60
        )

        if response_simples.status_code != 200:
            return {
                "status": "error",
                "error": f"Erro no /simples: {response_simples.status_code}",
                "json_bruto": json_bruto,
                "details": response_simples.text
            }

        relatorio = response_simples.json()

        if verbose:
            print(f"   ✓ Relatório recebido\n")

        # Processar e estruturar resultado
        resultado = process_relatorio(relatorio, pdf_path.name)

        if verbose:
            print(f"{'='*60}")
            print(f"Status: {resultado['status'].upper()}")
            if resultado['status'] == 'valid':
                print(f"Assinaturas: {resultado['total_assinaturas']}")
                for i, assinatura in enumerate(resultado['assinaturas'], 1):
                    print(f"  {i}. {assinatura.get('assinado_por', 'N/A')}")
            print(f"{'='*60}\n")
        return resultado

    except Exception as e:
        return {
            "status": "error",
            "error": f"Erro ao processar /simples: {str(e)}",
            "json_bruto": json_bruto
        }


def process_relatorio(relatorio, filename):
    """
    Processa o relatório simplificado e extrai informações estruturadas.
    Args:
        relatorio: JSON retornado pelo /simples
        filename: Nome do arquivo original
    Returns:
        dict estruturado com resultado
    """
    try:
        assinaturas = []
        if isinstance(relatorio, dict):
            if 'assinaturas' in relatorio:
                assinaturas_raw = relatorio['assinaturas']
            elif 'signatures' in relatorio:
                assinaturas_raw = relatorio['signatures']
            else:
                assinaturas_raw = []
                for key, value in relatorio.items():
                    if isinstance(value, list) and len(value) > 0:
                        if any(k in str(value[0]).lower() for k in ['assinado', 'cpf', 'certificado', 'signature']):
                            assinaturas_raw = value
                            break
            for assinatura in assinaturas_raw:
                if isinstance(assinatura, dict):
                    assinatura_info = {
                        'assinado_por': assinatura.get('nome', assinatura.get('signerName', assinatura.get('assinado_por', 'N/A'))),
                        'cpf': assinatura.get('cpf', assinatura.get('CPF', 'N/A')),
                        'certificadora': assinatura.get('certificadora', 'N/A'),
                        'numero_serie_certificado': assinatura.get('numSerial', assinatura.get('serialNumber', assinatura.get('numero_serie', 'N/A'))),
                        'data_assinatura': assinatura.get('data', assinatura.get('signatureDate', assinatura.get('data_assinatura', 'N/A'))),
                        'status': assinatura.get('status', assinatura.get('resultado', 'N/A')),
                        'possui_carimbo_tempo': assinatura.get('possuiCarimboTempo', False)
                    }
                    assinaturas.append(assinatura_info)
            doc_info = {
                'nome_arquivo': relatorio.get('nomeArquivo', filename),
                'hash': relatorio.get('hash', relatorio.get('documentHash', 'N/A')),
                'data_validacao': relatorio.get('dataValidacao', relatorio.get('validationDate', 'N/A')),
                'status_documento': relatorio.get('statusDocumento', 'N/A')
            }
            return {
                'status': 'valid' if assinaturas else 'invalid',
                'documento': doc_info,
                'assinaturas': assinaturas,
                'total_assinaturas': len(assinaturas),
                'relatorio_completo': relatorio
            }
        return {
            'status': 'unknown',
            'relatorio_completo': relatorio
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': f"Erro ao processar relatório: {str(e)}",
            'relatorio_completo': relatorio
        }