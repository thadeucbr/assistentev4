# 🎯 OAuth2 vs Service Account - Guia Rápido

## 🚀 Para Configurar OAuth2 (Recomendado para Docker)

### ✅ Vantagens do OAuth2:
- **Simples**: Não precisa compartilhar calendários
- **Direto**: Eventos aparecem no seu calendário principal
- **Seguro**: Tokens renováveis automaticamente
- **Docker-friendly**: Funciona perfeitamente em containers

### 📝 Passos Rápidos:

1. **Configure credenciais no Google Cloud:**
   ```bash
   # Acesse: https://console.cloud.google.com/
   # APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client IDs
   # Tipo: Web application
   # Redirect URI: http://localhost:3000/oauth/callback
   # Baixe o JSON como "google-oauth-credentials.json"
   ```

2. **Execute o configurador:**
   ```bash
   node setupGoogleOAuth.js
   ```

3. **Siga as instruções no terminal**

4. **Teste a funcionalidade:**
   ```bash
   node testCalendarFeature.js
   ```

## 🔄 Já tem Service Account? (Opcional)

Se já configurou Service Account e está funcionando, pode continuar usando:

```bash
# Para usar Service Account
export GOOGLE_CALENDAR_AUTH_TYPE=service_account

# Para mudar para OAuth2
export GOOGLE_CALENDAR_AUTH_TYPE=oauth2
```

## 🧪 Testando

```bash
# Teste completo
node testCalendarFeature.js

# Teste via WhatsApp
"agendar reunião para amanhã às 15h"
```

## 📁 Arquivos Necessários (OAuth2)

```
projeto/
├── google-oauth-credentials.json    # ← Baixe do Google Cloud
├── google-token.json               # ← Auto-gerado
├── setupGoogleOAuth.js             # ← Script configurador
└── .env                            # ← Auto-atualizado
```

## 🆘 Precisa de Ajuda?

- **OAuth2**: `node setupGoogleOAuth.js`
- **Service Account**: `node setupCalendarEmail.js` 
- **Teste completo**: `node testCalendarFeature.js`

---

**🎉 Recomendação**: Use OAuth2 para Docker - é mais simples e direto!
