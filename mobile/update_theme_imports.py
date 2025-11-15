#!/usr/bin/env python3
"""
Script para adicionar imports do tema centralizado a todas as telas
e substituir valores hard-coded por tokens do tema
"""

import re
import os

SCREENS_DIR = '/home/user/agapp/mobile/src/screens'

# Mapeamento de substituições de cores
COLOR_REPLACEMENTS = {
    "'#3471b9'": 'colors.primary',
    '"#3471b9"': 'colors.primary',
    "'#f5f5f5'": 'colors.backgroundDark',
    '"#f5f5f5"': 'colors.backgroundDark',
    "'#fff'": 'colors.white',
    '"#fff"': 'colors.white',
    "'#ffffff'": 'colors.white',
    '"#ffffff"': 'colors.white',
    "'#333'": 'colors.textPrimary',
    '"#333"': 'colors.textPrimary',
    "'#333333'": 'colors.textPrimary',
    '"#333333"': 'colors.textPrimary',
    "'#666'": 'colors.textSecondary',
    '"#666"': 'colors.textSecondary',
    "'#666666'": 'colors.textSecondary',
    '"#666666"': 'colors.textSecondary',
    "'#999'": 'colors.textDisabled',
    '"#999"': 'colors.textDisabled',
    "'#4caf50'": 'colors.success',
    '"#4caf50"': 'colors.success',
    "'#f44336'": 'colors.error',
    '"#f44336"': 'colors.error',
    "'#ff9800'": 'colors.secondary',
    '"#ff9800"': 'colors.secondary',
    "'#e0e0e0'": 'colors.gray300',
    '"#e0e0e0"': 'colors.gray300',
    "'#ccc'": 'colors.gray400',
    '"#ccc"': 'colors.gray400',
    "'#2196f3'": 'colors.info',
    '"#2196f3"': 'colors.info',
}

# Mapeamento de spacing
SPACING_REPLACEMENTS = {
    'padding: 4': f'padding: spacing.xs',
    'padding: 8': f'padding: spacing.sm',
    'padding: 12': f'padding: spacing.md',
    'padding: 16': f'padding: spacing.base',
    'padding: 20': f'padding: spacing.lg',
    'padding: 24': f'padding: spacing.xl',
    'padding: 32': f'padding: spacing["2xl"]',
    'padding: 40': f'padding: spacing["3xl"]',

    'margin: 4': f'margin: spacing.xs',
    'margin: 8': f'margin: spacing.sm',
    'margin: 12': f'margin: spacing.md',
    'margin: 16': f'margin: spacing.base',
    'margin: 20': f'margin: spacing.lg',
    'margin: 24': f'margin: spacing.xl',
    'margin: 32': f'margin: spacing["2xl"]',
    'margin: 40': f'margin: spacing["3xl"]',

    'marginBottom: 4': f'marginBottom: spacing.xs',
    'marginBottom: 8': f'marginBottom: spacing.sm',
    'marginBottom: 12': f'marginBottom: spacing.md',
    'marginBottom: 16': f'marginBottom: spacing.base',
    'marginBottom: 20': f'marginBottom: spacing.lg',
    'marginBottom: 24': f'marginBottom: spacing.xl',
    'marginBottom: 32': f'marginBottom: spacing["2xl"]',
    'marginBottom: 40': f'marginBottom: spacing["3xl"]',

    'marginTop: 4': f'marginTop: spacing.xs',
    'marginTop: 8': f'marginTop: spacing.sm',
    'marginTop: 12': f'marginTop: spacing.md',
    'marginTop: 16': f'marginTop: spacing.base',
    'marginTop: 20': f'marginTop: spacing.lg',
    'marginTop: 24': f'marginTop: spacing.xl',
    'marginTop: 32': f'marginTop: spacing["2xl"]',
    'marginTop: 40': f'marginTop: spacing["3xl"]',

    'paddingVertical: 4': f'paddingVertical: spacing.xs',
    'paddingVertical: 8': f'paddingVertical: spacing.sm',
    'paddingVertical: 12': f'paddingVertical: spacing.md',
    'paddingVertical: 16': f'paddingVertical: spacing.base',
    'paddingVertical: 24': f'paddingVertical: spacing.xl',

    'paddingHorizontal: 4': f'paddingHorizontal: spacing.xs',
    'paddingHorizontal: 8': f'paddingHorizontal: spacing.sm',
    'paddingHorizontal: 12': f'paddingHorizontal: spacing.md',
    'paddingHorizontal: 16': f'paddingHorizontal: spacing.base',
    'paddingHorizontal: 24': f'paddingHorizontal: spacing.xl',
}

# Mapeamento de borderRadius
BORDER_RADIUS_REPLACEMENTS = {
    'borderRadius: 4': 'borderRadius: borderRadius.sm',
    'borderRadius: 8': 'borderRadius: borderRadius.base',
    'borderRadius: 12': 'borderRadius: borderRadius.md',
}

# Mapeamento de fontSize
FONT_SIZE_REPLACEMENTS = {
    'fontSize: 10': 'fontSize: typography.fontSize.xs',
    'fontSize: 12': 'fontSize: typography.fontSize.sm',
    'fontSize: 13': 'fontSize: typography.fontSize.sm',
    'fontSize: 14': 'fontSize: typography.fontSize.base',
    'fontSize: 16': 'fontSize: typography.fontSize.md',
    'fontSize: 18': 'fontSize: typography.fontSize.lg',
    'fontSize: 20': 'fontSize: typography.fontSize.xl',
    'fontSize: 24': 'fontSize: typography.fontSize["2xl"]',
    'fontSize: 28': 'fontSize: typography.fontSize["3xl"]',
    'fontSize: 32': 'fontSize: typography.fontSize["4xl"]',
}

# Mapeamento de fontWeight
FONT_WEIGHT_REPLACEMENTS = {
    "fontWeight: 'bold'": 'fontWeight: typography.fontWeight.bold',
    'fontWeight: "bold"': 'fontWeight: typography.fontWeight.bold',
    "fontWeight: '600'": 'fontWeight: typography.fontWeight.semibold',
    'fontWeight: "600"': 'fontWeight: typography.fontWeight.semibold',
    "fontWeight: '500'": 'fontWeight: typography.fontWeight.medium',
    'fontWeight: "500"': 'fontWeight: typography.fontWeight.medium',
}

# Mapeamento de elevation/shadows
SHADOW_REPLACEMENTS = {
    'elevation: 2,': '...shadows.base,',
    'elevation: 3,': '...shadows.md,',
    'elevation: 4,': '...shadows.lg,',
}

def add_theme_import(content: str) -> str:
    """Adiciona import do tema se não existir"""
    if 'from \'../theme\'' in content or 'from "../theme"' in content:
        return content

    # Encontra a última linha de import
    import_pattern = r'(import .+ from .+;)\n'
    imports = list(re.finditer(import_pattern, content))

    if imports:
        last_import = imports[-1]
        insert_pos = last_import.end()
        theme_import = "import { colors, spacing, typography, borderRadius, shadows } from '../theme';\n"
        return content[:insert_pos] + theme_import + content[insert_pos:]

    return content

def apply_replacements(content: str) -> str:
    """Aplica todas as substituições de tema"""
    # Aplicar substituições de cores
    for old, new in COLOR_REPLACEMENTS.items():
        content = content.replace(old, new)

    # Aplicar substituições de spacing
    for old, new in SPACING_REPLACEMENTS.items():
        content = content.replace(old, new)

    # Aplicar substituições de borderRadius
    for old, new in BORDER_RADIUS_REPLACEMENTS.items():
        content = content.replace(old, new)

    # Aplicar substituições de fontSize
    for old, new in FONT_SIZE_REPLACEMENTS.items():
        content = content.replace(old, new)

    # Aplicar substituições de fontWeight
    for old, new in FONT_WEIGHT_REPLACEMENTS.items():
        content = content.replace(old, new)

    # Aplicar substituições de shadows
    for old, new in SHADOW_REPLACEMENTS.items():
        content = content.replace(old, new)

    return content

def process_screen(filepath: str) -> bool:
    """Processa um arquivo de tela"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Adicionar import do tema
        content = add_theme_import(content)

        # Aplicar substituições
        content = apply_replacements(content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return True
    except Exception as e:
        print(f"Erro ao processar {filepath}: {e}")
        return False

def main():
    """Processa todas as telas"""
    screens = [
        'RoleSelectionScreen.tsx',
        'RoleChoiceScreen.tsx',
        'ClientDashboardScreen.tsx',
        'ProfessionalDashboardScreen.tsx',
        'CreateProjectScreen.tsx',
        'AddressSearchScreen.tsx',
        'ProjectDetailsScreen.tsx',
        'ProfileSettingsScreen.tsx',
        'ContractManagementScreen.tsx',
        'BuyCreditsScreen.tsx',
        'PaymentWebViewScreen.tsx',
        'ChoiceScreen.tsx',
    ]

    for screen in screens:
        filepath = os.path.join(SCREENS_DIR, screen)
        if os.path.exists(filepath):
            if process_screen(filepath):
                print(f"✓ {screen} atualizado")
            else:
                print(f"✗ {screen} falhou")
        else:
            print(f"? {screen} não encontrado")

if __name__ == '__main__':
    main()
