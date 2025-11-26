# Templates de Anúncios - Guia de Uso

Este diretório contém templates prontos para criar anúncios no sistema.

## 📁 Arquivos

- `publi_screen_template.html` - Template para PubliScreen (tela cheia)
- `banner_template.html` - Template para Banner (home)
- `style.css` - Estilos para PubliScreen
- `script.js` - Scripts para PubliScreen

## 🎨 Como Criar um Anúncio

### 1. PubliScreen (Tela Cheia)

1. **Copie os arquivos base:**
   - `publi_screen_template.html` → renomeie para `index.html`
   - `style.css`
   - `script.js`

2. **Personalize o HTML:**
   - Edite o título, descrição e textos do botão
   - Adicione sua logo (pode ser PNG, JPG, SVG)

3. **Personalize as cores no CSS:**
   ```css
   /* Altere o gradiente de fundo */
   background: linear-gradient(135deg, #SUA_COR_1 0%, #SUA_COR_2 100%);
   ```

4. **Faça upload no admin:**
   - Acesse `/system-admin/ads`
   - Escolha o tipo (PubliScreen Cliente ou Profissional)
   - Faça upload dos 3 arquivos: `index.html`, `style.css`, `script.js`
   - Se tiver logo, faça upload também (ex: `logo.png`)

### 2. Banner (Home)

1. **Use o template:**
   - Copie `banner_template.html` → renomeie para `index.html`

2. **Personalize:**
   - Edite título e descrição
   - Escolha entre usar emoji ou imagem
   - Ajuste as cores no CSS inline

3. **Faça upload:**
   - Acesse `/system-admin/ads`
   - Escolha o tipo (Banner Cliente ou Profissional)
   - Faça upload do `index.html`
   - Se usar imagem, faça upload também

## 📱 Como os Anúncios Aparecem no Mobile

### PubliScreen
Exibido **após o login** do usuário em tela cheia. O usuário pode:
- Ver o conteúdo completo
- Clicar no botão de ação
- Fechar o anúncio

### Banner
Exibido na **tela home** como um card horizontal. O usuário pode:
- Ver rapidamente
- Clicar para interagir

## 🔧 Personalização Avançada

### Adicionar Link Externo

No `script.js` ou no banner, adicione:

```javascript
function handleClick() {
    // Notifica o app
    window.ReactNativeWebView?.postMessage('click');

    // Abre link externo
    window.open('https://seusite.com', '_blank');
}
```

### Adicionar Vídeo

```html
<div class="content">
    <video width="100%" controls autoplay muted>
        <source src="video.mp4" type="video/mp4">
    </video>
</div>
```

**Importante:** Faça upload do arquivo `video.mp4` junto com o HTML.

### Adicionar Animações

No CSS:

```css
@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.cta-button {
    animation: pulse 2s infinite;
}
```

## 📏 Dimensões Recomendadas

### PubliScreen
- **Largura:** Adapta-se à tela do celular
- **Altura:** Ilimitada (pode fazer scroll)
- **Logo:** 200-300px de largura
- **Imagens:** Até 5MB cada

### Banner
- **Altura:** 100-120px
- **Largura:** 100% da tela
- **Imagens:** 80x80px (quadradas)
- **Ícones:** Emojis ou fontes de ícones

## ⚠️ Boas Práticas

1. **Performance:**
   - Otimize imagens (use TinyPNG ou similar)
   - Limite o tamanho total a 5MB
   - Evite muitas animações pesadas

2. **Responsividade:**
   - Teste em diferentes tamanhos de tela
   - Use unidades relativas (%, em, rem)
   - Adicione media queries para mobile

3. **Acessibilidade:**
   - Use textos alternativos em imagens (`alt=""`)
   - Mantenha bom contraste de cores
   - Tamanho de fonte legível (mín 14px)

4. **Segurança:**
   - Não adicione scripts maliciosos
   - Não inclua links suspeitos
   - Evite coletar dados do usuário

## 🎯 Exemplos de Uso

### Promoção Simples
```html
<h1>🎉 50% OFF</h1>
<p>Em todos os serviços até sexta-feira!</p>
<button onclick="handleClick()">Aproveitar Agora</button>
```

### Novo Recurso
```html
<h1>🚀 Novo Recurso!</h1>
<p>Agora você pode agendar serviços com profissionais verificados.</p>
<button onclick="handleClick()">Conhecer</button>
```

### Evento
```html
<h1>📅 Webinar Gratuito</h1>
<p>Como aumentar sua visibilidade na plataforma</p>
<button onclick="handleClick()">Inscrever-se</button>
```

## 🐛 Solução de Problemas

**Anúncio não aparece:**
- Verifique se fez upload do `index.html`
- Confirme se está no tipo correto (client/professional)
- Veja os logs do app mobile

**Imagens não carregam:**
- Certifique-se que o nome no HTML bate com o arquivo
- Verifique se fez upload da imagem
- Extensões permitidas: png, jpg, jpeg, gif, svg, webp

**Botão fechar não funciona:**
- Verifique se tem a função `closeAd()` no script
- Confirme se está enviando a mensagem correta:
  ```javascript
  window.ReactNativeWebView?.postMessage('close');
  ```

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.
