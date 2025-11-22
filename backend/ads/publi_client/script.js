// Add animation on load
document.addEventListener('DOMContentLoaded', function() {
    console.log('PubliScreen Cliente carregado!');

    // Animate features on load
    const features = document.querySelectorAll('.feature');
    features.forEach((feature, index) => {
        setTimeout(() => {
            feature.style.animation = `fadeIn 0.5s ease-in forwards`;
        }, 300 + (index * 150));
    });
});

// Function to close the ad (called by React Native WebView)
function closeAd() {
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('close');
    }
}
