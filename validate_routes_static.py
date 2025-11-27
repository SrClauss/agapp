#!/usr/bin/env python3
"""
Validação estática das rotas de ads (sem importar FastAPI)
"""
import re
import sys

def analyze_routes_in_file(filepath):
    """Analisa rotas definidas em um arquivo Python"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Padrões para encontrar rotas
    route_patterns = [
        r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)',
    ]

    routes = []
    for pattern in route_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            method = match.group(1).upper()
            path = match.group(2)
            routes.append((method, path))

    return routes

def test_ads_routes():
    """Testa as rotas do arquivo ads.py"""
    print("=" * 70)
    print("VALIDAÇÃO ESTÁTICA DAS ROTAS DE ADS")
    print("=" * 70)

    ads_file = '/home/user/agapp/backend/app/api/endpoints/ads.py'

    print(f"\n✓ Analisando: {ads_file}")
    routes = analyze_routes_in_file(ads_file)

    print(f"\n  Total de rotas encontradas: {len(routes)}")
    print("\n  Rotas definidas:\n")

    # Organizar por categoria
    admin_routes = []
    public_routes = []

    for method, path in routes:
        if '/admin/' in path:
            admin_routes.append((method, path))
        elif '/public/' in path:
            public_routes.append((method, path))

    # Mostrar rotas admin
    print("  📋 ROTAS ADMIN (requerem autenticação):")
    for i, (method, path) in enumerate(admin_routes, 1):
        print(f"    {i}. {method:6} /ads{path}")

    # Mostrar rotas públicas
    print("\n  🌐 ROTAS PÚBLICAS (mobile):")
    for i, (method, path) in enumerate(public_routes, len(admin_routes) + 1):
        print(f"    {i}. {method:6} /ads{path}")

    # Validar contagem
    print("\n" + "=" * 70)
    print("VALIDAÇÕES:")
    print("=" * 70)

    expected_count = 13
    actual_count = len(routes)

    checks = []

    # Check 1: Total de rotas
    check1 = actual_count == expected_count
    checks.append(("Total de rotas (esperado: 13)", check1))
    status1 = "✓" if check1 else "✗"
    print(f"{status1} Total de rotas: {actual_count} (esperado: {expected_count})")

    # Check 2: Rotas admin
    expected_admin = 8
    actual_admin = len(admin_routes)
    check2 = actual_admin == expected_admin
    checks.append(("Rotas admin (esperado: 8)", check2))
    status2 = "✓" if check2 else "✗"
    print(f"{status2} Rotas admin: {actual_admin} (esperado: {expected_admin})")

    # Check 3: Rotas públicas
    expected_public = 5
    actual_public = len(public_routes)
    check3 = actual_public == expected_public
    checks.append(("Rotas públicas (esperado: 5)", check3))
    status3 = "✓" if check3 else "✗"
    print(f"{status3} Rotas públicas: {actual_public} (esperado: {expected_public})")

    # Check 4: Rotas de preview (4)
    preview_routes = [r for m, r in admin_routes if '/preview/' in r]
    check4 = len(preview_routes) == 4
    checks.append(("Rotas de preview (esperado: 4)", check4))
    status4 = "✓" if check4 else "✗"
    print(f"{status4} Rotas de preview: {len(preview_routes)} (esperado: 4)")

    # Check 5: Rotas de GET público (4)
    public_get_routes = [r for m, r in public_routes if m == 'GET']
    check5 = len(public_get_routes) == 4
    checks.append(("Rotas GET públicas (esperado: 4)", check5))
    status5 = "✓" if check5 else "✗"
    print(f"{status5} Rotas GET públicas: {len(public_get_routes)} (esperado: 4)")

    # Check 6: Rota de click tracking
    click_routes = [r for m, r in public_routes if 'click' in r]
    check6 = len(click_routes) == 1
    checks.append(("Rota de click tracking (esperado: 1)", check6))
    status6 = "✓" if check6 else "✗"
    print(f"{status6} Rota de click tracking: {len(click_routes)} (esperado: 1)")

    return all(result for _, result in checks)

def test_main_py():
    """Testa se o main.py não tem conflito de StaticFiles"""
    print("\n" + "=" * 70)
    print("VALIDAÇÃO DO MAIN.PY (conflitos)")
    print("=" * 70)

    main_file = '/home/user/agapp/backend/app/main.py'

    print(f"\n✓ Analisando: {main_file}")

    with open(main_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Procurar por app.mount com /ads
    mount_ads_pattern = r'app\.mount\(["\']\/ads'
    mount_matches = re.findall(mount_ads_pattern, content)

    # Procurar por include_router de ads
    include_ads_pattern = r'app\.include_router\(ads\.router'
    include_matches = re.findall(include_ads_pattern, content)

    print(f"\n  app.mount('/ads', ...) encontrados: {len(mount_matches)}")
    print(f"  app.include_router(ads.router) encontrados: {len(include_matches)}")

    print("\n" + "=" * 70)
    print("VALIDAÇÕES:")
    print("=" * 70)

    # Check: Não deve ter mount de /ads
    check1 = len(mount_matches) == 0
    status1 = "✓" if check1 else "✗"
    print(f"{status1} Não há app.mount('/ads', ...) - conflito removido")

    # Check: Deve ter include_router de ads
    check2 = len(include_matches) >= 1
    status2 = "✓" if check2 else "✗"
    print(f"{status2} Existe app.include_router(ads.router)")

    return check1 and check2

def test_admin_py():
    """Testa se admin.py não tem rotas duplicadas"""
    print("\n" + "=" * 70)
    print("VALIDAÇÃO DO ADMIN.PY (rotas duplicadas)")
    print("=" * 70)

    admin_file = '/home/user/agapp/backend/app/api/admin.py'

    print(f"\n✓ Analisando: {admin_file}")

    routes = analyze_routes_in_file(admin_file)

    # Filtrar apenas rotas relacionadas a ads
    ads_routes = [(m, p) for m, p in routes if 'ads' in p.lower()]

    print(f"\n  Rotas com 'ads' encontradas: {len(ads_routes)}")

    for method, path in ads_routes:
        print(f"    → {method:6} {path}")

    print("\n" + "=" * 70)
    print("VALIDAÇÕES:")
    print("=" * 70)

    # A única rota permitida é GET /ads (página HTML)
    allowed_routes = [p for m, p in ads_routes if p == '/ads' and m == 'GET']

    check = len(ads_routes) == len(allowed_routes)
    status = "✓" if check else "✗"
    print(f"{status} Apenas rota GET /ads mantida (página HTML)")

    if not check:
        print(f"  ⚠ Encontradas {len(ads_routes) - len(allowed_routes)} rotas não esperadas")

    return check

def main():
    print("\n")
    results = []

    # Teste 1: Rotas de ads.py
    results.append(("Rotas ads.py", test_ads_routes()))

    # Teste 2: main.py sem conflitos
    results.append(("main.py sem conflitos", test_main_py()))

    # Teste 3: admin.py sem duplicatas
    results.append(("admin.py sem duplicatas", test_admin_py()))

    # Resumo final
    print("\n" + "=" * 70)
    print("RESUMO FINAL")
    print("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASSOU" if result else "✗ FALHOU"
        print(f"{test_name:30} {status}")

    print("=" * 70)
    if passed == total:
        print(f"✓ SUCESSO: Todos os {total} testes passaram!")
    else:
        print(f"✗ FALHA: {total - passed} de {total} testes falharam")
    print("=" * 70)

    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
