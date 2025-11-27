#!/usr/bin/env python3
"""
Script de teste para validar as rotas de ads
"""
import sys
sys.path.insert(0, '/home/user/agapp/backend')

def test_imports():
    """Testa se os módulos importam corretamente"""
    print("✓ Testando imports...")
    try:
        from app.api.endpoints import ads
        from app.main import app
        print("  ✓ Imports OK")
        return True
    except Exception as e:
        print(f"  ✗ Erro no import: {e}")
        return False

def test_ads_router():
    """Testa se as rotas de ads estão definidas"""
    print("\n✓ Testando rotas do ads.py...")
    try:
        from app.api.endpoints import ads

        # Verificar se o router existe
        assert hasattr(ads, 'router'), "Router não encontrado"

        # Contar as rotas
        routes = [route for route in ads.router.routes]
        print(f"  ✓ Total de rotas: {len(routes)}")

        # Listar as rotas
        expected_routes = [
            "/admin/locations",
            "/admin/upload/{location}",
            "/admin/delete-all/{location}",
            "/admin/delete-file/{location}/{filename}",
            "/admin/preview/publi-screen-client",
            "/admin/preview/publi-screen-professional",
            "/admin/preview/banner-client-home",
            "/admin/preview/banner-professional-home",
            "/public/publi-screen-client",
            "/public/publi-screen-professional",
            "/public/banner-client-home",
            "/public/banner-professional-home",
            "/public/click/{location}",
        ]

        found_routes = []
        for route in routes:
            if hasattr(route, 'path'):
                found_routes.append(route.path)
                method = list(route.methods)[0] if hasattr(route, 'methods') else "N/A"
                print(f"  → {method:6} {route.path}")

        # Verificar se todas as rotas esperadas existem
        missing_routes = set(expected_routes) - set(found_routes)
        if missing_routes:
            print(f"\n  ⚠ Rotas faltando: {missing_routes}")
        else:
            print(f"\n  ✓ Todas as {len(expected_routes)} rotas esperadas estão presentes!")

        return len(missing_routes) == 0
    except Exception as e:
        print(f"  ✗ Erro ao testar rotas: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_main_app():
    """Testa se o app principal está configurado corretamente"""
    print("\n✓ Testando configuração do app principal...")
    try:
        from app.main import app

        # Verificar se a rota /ads está incluída
        all_routes = []
        for route in app.routes:
            if hasattr(route, 'path'):
                all_routes.append(route.path)

        # Procurar por rotas que começam com /ads
        ads_routes = [r for r in all_routes if '/ads' in r]

        print(f"  ✓ Rotas com /ads encontradas: {len(ads_routes)}")
        for route in ads_routes[:5]:  # Mostrar apenas as primeiras 5
            print(f"    → {route}")

        if len(ads_routes) > 5:
            print(f"    ... e mais {len(ads_routes) - 5} rotas")

        return True
    except Exception as e:
        print(f"  ✗ Erro ao testar app: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_no_staticfiles_conflict():
    """Verifica se não há conflito com StaticFiles"""
    print("\n✓ Verificando conflito de StaticFiles...")
    try:
        from app.main import app

        # Verificar se há mount para /ads
        static_mounts = []
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'app'):
                # Verificar se é um StaticFiles mount
                if 'StaticFiles' in str(type(route.app)):
                    static_mounts.append((route.path, type(route.app).__name__))

        print(f"  ✓ StaticFiles mounts encontrados: {len(static_mounts)}")
        for path, app_type in static_mounts:
            print(f"    → {path} ({app_type})")

        # Verificar se /ads está montado como StaticFiles (não deveria estar)
        ads_static = [path for path, _ in static_mounts if path == '/ads']

        if ads_static:
            print(f"  ✗ CONFLITO DETECTADO: /ads está montado como StaticFiles!")
            return False
        else:
            print(f"  ✓ Sem conflito: /ads não está montado como StaticFiles")
            return True

    except Exception as e:
        print(f"  ✗ Erro ao verificar conflitos: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("TESTE DE VALIDAÇÃO DAS ROTAS DE ADS")
    print("=" * 60)

    results = []

    # Teste 1: Imports
    results.append(("Imports", test_imports()))

    # Teste 2: Rotas do ads.py
    results.append(("Rotas ads.py", test_ads_router()))

    # Teste 3: App principal
    results.append(("App principal", test_main_app()))

    # Teste 4: Conflitos
    results.append(("Sem conflitos", test_no_staticfiles_conflict()))

    # Resumo
    print("\n" + "=" * 60)
    print("RESUMO DOS TESTES")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASSOU" if result else "✗ FALHOU"
        print(f"{test_name:20} {status}")

    print("=" * 60)
    print(f"RESULTADO: {passed}/{total} testes passaram")
    print("=" * 60)

    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
