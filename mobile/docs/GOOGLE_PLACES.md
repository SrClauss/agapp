# Google Places API — Como obter a chave (pt-BR)

Siga estes passos para criar uma API key e habilitar o Places API para uso no app mobile:

1. Acesse o Google Cloud Console: https://console.cloud.google.com/
2. Selecione ou crie um *Project* (ex.: "AgilizaPro Mobile").
3. Habilite as APIs necessárias:
   - APIs -> Library -> procure "Places API" e clique em "Enable".
4. Crie uma credencial (API key):
   - APIs & Services -> Credentials -> Create Credentials -> API key
   - Guarde a chave gerada (ex.: `AIza...`).
5. (Recomendado) Restrinja a chave para uso apenas em seu aplicativo:
   - Na tela de credenciais, clique na API key criada.
   - Em "Application restrictions" escolha "Android apps" (package name + SHA-1), "iOS apps", ou "HTTP referrers" conforme seu uso, ou use "None" apenas em desenvolvimento.
   - Em "API restrictions" selecione "Restrict key" e marque apenas **Places API**.
6. Adicione a chave no arquivo `mobile/.env` (não comitar a chave pública no repositório):

```
# EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza....
```

Observações:
- No Expo, variáveis que começam com `EXPO_PUBLIC_` são embutidas no bundle e visíveis no cliente. Se desejar esconder a chave, implemente um *proxy* no backend que faça as chamadas ao Google e mantenha a chave apenas no servidor.
- Para produção, sempre restrinja a key por plataforma e pela API para reduzir risco de uso indevido.

Referências:
- Google Places API docs: https://developers.google.com/maps/documentation/places/web-service/overview
