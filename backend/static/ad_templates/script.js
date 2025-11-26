// Função para fechar o anúncio
function closeAd() {
    // Envia mensagem para o React Native
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('close');
    } else {
        // Fallback para preview no navegador
        window.close();
    }
}

// Função para rastrear cliques
function handleClick() {
    // Envia mensagem para o React Native
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('click');
    }

    // Aqui você pode adicionar lógica adicional
    // Por exemplo, abrir um link externo:
    // window.open('https://seusite.com', '_blank');

    console.log('Usuário clicou no botão CTA');
}

// Prevenir zoom no iOS
document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
    document.body.style.zoom = 0.99;
});

document.addEventListener('gesturechange', function(e) {
    e.preventDefault();
    document.body.style.zoom = 0.99;
});

document.addEventListener('gestureend', function(e) {
    e.preventDefault();
    document.body.style.zoom = 1;
});
